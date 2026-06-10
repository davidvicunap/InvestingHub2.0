"""Simulated real-time market-data stream over WebSocket.

yfinance has no push feed, so this module polls quotes on a single shared
background thread and fans them out to every subscribed WebSocket client. The
browser talks WebSocket-first; the polling is an implementation detail hidden
server-side.

Wiring (in app.py):

    from stream import init_stream
    init_stream(app, live_quote)   # live_quote(symbol) -> tick dict

Client protocol (JSON text frames over /ws):

    -> {"type": "set",         "symbols": ["AAPL", "BTC-USD"]}   # replace subscription
    -> {"type": "subscribe",   "symbols": ["MSFT"]}             # add
    -> {"type": "unsubscribe", "symbols": ["AAPL"]}            # remove
    <- {"type": "hello", "interval": 3.0}
    <- {"type": "tick",  "quotes": [ {symbol, price, change, ...}, ... ]}
"""

import json
import logging
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor

from flask_sock import Sock

log = logging.getLogger(__name__)

# How often the poller re-fetches the union of subscribed symbols. Low enough to
# feel live, high enough to stay polite to Yahoo for a single-user terminal.
POLL_INTERVAL = float(os.environ.get("STREAM_POLL_SECONDS", "3"))
_MAX_FETCH_WORKERS = 8

_quote_fn = None                      # injected: symbol -> tick dict
_clients = set()                      # live _Client objects
_clients_lock = threading.Lock()
_poller_started = False


class _Client:
    """One WebSocket connection and the symbols it cares about.

    Each connection runs the receive loop on its own thread (flask-sock); the
    shared poller thread also writes to it, so every send is serialized through
    this client's lock to keep the socket writes from interleaving.
    """

    __slots__ = ("ws", "symbols", "_send_lock")

    def __init__(self, ws):
        self.ws = ws
        self.symbols = set()
        self._send_lock = threading.Lock()

    def send_json(self, obj):
        with self._send_lock:
            self.ws.send(json.dumps(obj))


def _remove(client):
    with _clients_lock:
        _clients.discard(client)


def _fetch_many(symbols):
    """Fetch ticks for `symbols` concurrently; returns {symbol: tick}."""
    symbols = list(symbols)
    if not symbols:
        return {}

    def one(sym):
        try:
            return sym, _quote_fn(sym)
        except Exception:
            return sym, None

    out = {}
    with ThreadPoolExecutor(max_workers=min(len(symbols), _MAX_FETCH_WORKERS)) as ex:
        for sym, tick in ex.map(one, symbols):
            if tick:
                out[sym] = tick
    return out


def _poller():
    """Shared loop: poll the union of all subscribed symbols, fan out per client."""
    while True:
        time.sleep(POLL_INTERVAL)
        with _clients_lock:
            clients = list(_clients)
        if not clients:
            continue
        wanted = set()
        for c in clients:
            wanted |= c.symbols
        if not wanted:
            continue
        quotes = _fetch_many(wanted)
        if not quotes:
            continue
        for c in clients:
            batch = [quotes[s] for s in c.symbols if s in quotes]
            if not batch:
                continue
            try:
                c.send_json({"type": "tick", "quotes": batch})
            except Exception:
                _remove(c)


def _ensure_poller():
    global _poller_started
    with _clients_lock:
        if _poller_started:
            return
        _poller_started = True
    threading.Thread(target=_poller, name="stream-poller", daemon=True).start()


def _push_now(client):
    """Send an immediate tick for the client's current symbols so the UI doesn't
    wait a full poll interval after (re)subscribing."""
    quotes = _fetch_many(client.symbols)
    batch = list(quotes.values())
    if batch:
        try:
            client.send_json({"type": "tick", "quotes": batch})
        except Exception:
            _remove(client)


def _handle_message(client, raw):
    try:
        msg = json.loads(raw)
    except (ValueError, TypeError):
        return
    action = msg.get("type") or msg.get("action")
    syms = {str(s).upper().strip() for s in (msg.get("symbols") or []) if s}
    if action in ("subscribe", "sub"):
        client.symbols |= syms
    elif action in ("unsubscribe", "unsub"):
        client.symbols -= syms
    elif action in ("set", "replace"):
        client.symbols = set(syms)
    else:
        return
    if client.symbols:
        _push_now(client)


def init_stream(app, quote_fn):
    """Attach the /ws endpoint to `app`. `quote_fn(symbol)` returns a tick dict."""
    global _quote_fn
    _quote_fn = quote_fn
    sock = Sock(app)

    @sock.route("/ws")
    def ws_stream(ws):
        client = _Client(ws)
        with _clients_lock:
            _clients.add(client)
        _ensure_poller()
        try:
            client.send_json({"type": "hello", "interval": POLL_INTERVAL})
            while True:
                raw = ws.receive()      # blocks; None when the client disconnects
                if raw is None:
                    break
                _handle_message(client, raw)
        finally:
            _remove(client)

    return sock
