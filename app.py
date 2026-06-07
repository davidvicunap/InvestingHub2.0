import gzip
import json
import logging
import math
import re
import sqlite3
import os
import time
import urllib.parse
import urllib.request
from collections import OrderedDict, defaultdict
from datetime import datetime, timedelta, timezone
from functools import wraps
from concurrent.futures import ThreadPoolExecutor
from flask import Flask, jsonify, request, g
from flask_cors import CORS
import yfinance as yf
import pandas as pd
import numpy as np
import jwt
import bcrypt

log = logging.getLogger(__name__)

app = Flask(__name__)

_allowed_origins = [
    "https://davidvicunap.github.io",
    # Any localhost port for local development (CORS guards browsers, not the
    # server; authenticated calls still require a valid JWT).
    re.compile(r"^http://(localhost|127\.0\.0\.1):\d+$"),
]
CORS(app, origins=_allowed_origins)

app.config["DATABASE"] = os.environ.get("DATABASE_PATH", os.path.join(app.root_path, "portfolio.db"))

_secret = os.environ.get("SECRET_KEY", "")
if not _secret and not os.environ.get("FLASK_DEBUG"):
    _secret = "investorhub-dev-key-local-only"
    log.warning("SECRET_KEY not set — using insecure dev default. Set SECRET_KEY env var in production.")
app.config["SECRET_KEY"] = _secret


# -- Database -----------------------------------------------------------------

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(app.config["DATABASE"])
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    db = sqlite3.connect(app.config["DATABASE"])
    db.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT DEFAULT '',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    db.execute("""
        CREATE TABLE IF NOT EXISTS holdings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            symbol TEXT NOT NULL,
            name TEXT DEFAULT '',
            shares REAL NOT NULL,
            buy_price REAL NOT NULL,
            buy_date TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    db.execute("""
        CREATE TABLE IF NOT EXISTS watchlist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            symbol TEXT NOT NULL,
            name TEXT DEFAULT '',
            added_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, symbol)
        )
    """)
    db.commit()
    db.close()


# -- Auth Helpers -------------------------------------------------------------

def create_token(user_id, email):
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, app.config["SECRET_KEY"], algorithm="HS256")


def get_current_user():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header[7:]
    try:
        payload = jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Authentication required"}), 401
        g.current_user = user
        return f(*args, **kwargs)
    return decorated


def optional_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        g.current_user = get_current_user()
        return f(*args, **kwargs)
    return decorated


# -- Rate Limiting (in-memory, per-IP) ----------------------------------------

_rate_buckets = defaultdict(list)


def _client_ip():
    fwd = request.headers.get("X-Forwarded-For", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.remote_addr or "unknown"


def rate_limit(bucket, max_hits=10, window=300):
    """Return True if the caller is within the limit, False if throttled.

    Sliding window keyed by (bucket, client IP). Used to blunt credential
    stuffing / brute-force against the auth endpoints.
    """
    now = time.time()
    key = f"{bucket}:{_client_ip()}"
    hits = [t for t in _rate_buckets[key] if now - t < window]
    hits.append(now)
    _rate_buckets[key] = hits
    if len(_rate_buckets) > 5000:  # crude memory guard
        for k in list(_rate_buckets):
            if not any(now - t < window for t in _rate_buckets[k]):
                del _rate_buckets[k]
    return len(hits) <= max_hits


# -- LRU Cache with TTL -------------------------------------------------------

class LRUCache:
    """Thread-safe-ish LRU dict with per-entry TTL and a max size."""
    def __init__(self, maxsize=200, default_ttl=300):
        self._data = OrderedDict()
        self._maxsize = maxsize
        self._ttl = default_ttl

    def get(self, key, ttl=None):
        ttl = ttl or self._ttl
        entry = self._data.get(key)
        if entry is None:
            return None
        if (datetime.now(timezone.utc).timestamp() - entry[1]) > ttl:
            self._data.pop(key, None)
            return None
        self._data.move_to_end(key)
        return entry[0]

    def put(self, key, value):
        self._data[key] = (value, datetime.now(timezone.utc).timestamp())
        self._data.move_to_end(key)
        while len(self._data) > self._maxsize:
            self._data.popitem(last=False)

    def clear(self):
        self._data.clear()


# -- Helper: cache yfinance Ticker objects + info (5-min TTL) ----------------

_ticker_cache = LRUCache(maxsize=200, default_ttl=300)
_info_cache = LRUCache(maxsize=200, default_ttl=300)


def get_ticker(symbol: str) -> yf.Ticker:
    s = symbol.upper().strip()
    cached = _ticker_cache.get(s)
    if cached:
        return cached
    t = yf.Ticker(s)
    _ticker_cache.put(s, t)
    return t


def get_info(symbol: str) -> dict:
    """Get ticker .info with caching. This is the main perf win."""
    s = symbol.upper().strip()
    cached = _info_cache.get(s)
    if cached is not None:
        return cached
    t = get_ticker(s)
    info = t.info
    _info_cache.put(s, info)
    return info


def safe_get(d, key, default=None):
    try:
        v = d.get(key, default)
        if v is None:
            return default
        if isinstance(v, float) and (np.isnan(v) or np.isinf(v)):
            return default
        return v
    except Exception:
        return default


def dividend_yield_fraction(info, price=None):
    """Return the forward dividend yield as a *fraction* (e.g. 0.027 for 2.7%).

    yfinance is inconsistent across versions: older releases returned a fraction
    while >=0.2.40 returns a percent number (e.g. 2.67 for 2.67%). Computing it
    from the annual dividend rate and price is version-independent, so prefer
    that and only fall back to the (percent-scaled) `dividendYield` field.
    """
    rate = safe_get(info, "dividendRate", 0) or 0
    price = price or safe_get(info, "currentPrice") or safe_get(info, "regularMarketPrice", 0) or 0
    if rate and price:
        return round(rate / price, 5)
    raw = safe_get(info, "dividendYield", 0) or 0
    if not raw:
        return 0
    # Heuristic: a "fraction" yield above 1.0 (100%) is implausible, so any
    # value >1 is certainly already a percent; modern yfinance always is.
    return round(raw / 100.0, 5)


def peg_ratio(info):
    """PEG ratio, preferring `trailingPegRatio` when the legacy field is absent."""
    return safe_get(info, "pegRatio", 0) or safe_get(info, "trailingPegRatio", 0) or 0


# -- Response Cache -----------------------------------------------------------

_resp_cache = LRUCache(maxsize=300, default_ttl=60)


def cache_response(ttl):
    """Cache successful GET responses in memory for `ttl` seconds."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            key = request.full_path.rstrip("?")
            cached = _resp_cache.get(key, ttl=ttl)
            if cached is not None:
                return cached
            result = f(*args, **kwargs)
            status = result[1] if isinstance(result, tuple) else 200
            if 200 <= status < 300:
                _resp_cache.put(key, result)
            return result
        return wrapper
    return decorator


# -- Gzip Compression ---------------------------------------------------------

_GZIP_MIN_BYTES = 1024


@app.after_request
def _compress(response):
    """Gzip large JSON/text responses when the client supports it.

    Guards on an existing Content-Encoding so cached (already-compressed)
    responses returned a second time aren't double-compressed.
    """
    try:
        if response.headers.get("Content-Encoding"):
            return response
        if "gzip" not in request.headers.get("Accept-Encoding", "").lower():
            return response
        if response.direct_passthrough or response.status_code >= 300:
            return response
        ctype = response.headers.get("Content-Type", "")
        if not ("application/json" in ctype or ctype.startswith("text/")):
            return response
        data = response.get_data()
        if len(data) < _GZIP_MIN_BYTES:
            return response
        response.set_data(gzip.compress(data, compresslevel=6))
        response.headers["Content-Encoding"] = "gzip"
        response.headers["Content-Length"] = len(response.get_data())
        response.headers.add("Vary", "Accept-Encoding")
    except Exception:
        pass
    return response


# -- API: Health Check --------------------------------------------------------

@app.route("/")
def health():
    return jsonify({"status": "ok"})


# -- API: Auth ----------------------------------------------------------------

@app.route("/api/auth/register", methods=["POST"])
def api_register():
    if not rate_limit("register", max_hits=10, window=3600):
        return jsonify({"error": "Too many attempts. Please try again later."}), 429
    data = request.get_json()
    if not data or not data.get("email") or not data.get("password"):
        return jsonify({"error": "Email and password are required"}), 400

    email = data["email"].strip().lower()
    password = data["password"]
    name = data.get("name", "").strip()

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    db = get_db()
    try:
        cursor = db.execute(
            "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)",
            (email, password_hash, name)
        )
        db.commit()
        user_id = cursor.lastrowid
        token = create_token(user_id, email)
        return jsonify({
            "token": token,
            "user": {"id": user_id, "email": email, "name": name}
        }), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "Email already registered"}), 409


@app.route("/api/auth/login", methods=["POST"])
def api_login():
    if not rate_limit("login", max_hits=15, window=300):
        return jsonify({"error": "Too many login attempts. Please wait a few minutes."}), 429
    data = request.get_json()
    if not data or not data.get("email") or not data.get("password"):
        return jsonify({"error": "Email and password are required"}), 400

    email = data["email"].strip().lower()
    password = data["password"]

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if not user:
        return jsonify({"error": "Invalid email or password"}), 401

    if not bcrypt.checkpw(password.encode("utf-8"), user["password_hash"].encode("utf-8")):
        return jsonify({"error": "Invalid email or password"}), 401

    token = create_token(user["id"], email)
    return jsonify({
        "token": token,
        "user": {"id": user["id"], "email": user["email"], "name": user["name"]}
    })


@app.route("/api/auth/me", methods=["GET"])
@require_auth
def api_me():
    user = g.current_user
    db = get_db()
    row = db.execute("SELECT id, email, name, created_at FROM users WHERE id = ?", (user["user_id"],)).fetchone()
    if not row:
        return jsonify({"error": "User not found"}), 404
    return jsonify(dict(row))


# -- API: Search --------------------------------------------------------------

@app.route("/api/search")
@cache_response(600)
def api_search():
    q = request.args.get("q", "").strip()
    if len(q) < 1:
        return jsonify([])
    try:
        encoded_q = urllib.parse.quote(q, safe="")
        url = f"https://query2.finance.yahoo.com/v1/finance/search?q={encoded_q}&quotesCount=8&newsCount=0"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
        results = []
        for item in data.get("quotes", []):
            if item.get("quoteType") in ("EQUITY", "ETF", "MUTUALFUND", "INDEX"):
                results.append({
                    "symbol": item.get("symbol", ""),
                    "name": item.get("shortname") or item.get("longname", ""),
                    "type": item.get("quoteType", ""),
                    "exchange": item.get("exchange", ""),
                })
        return jsonify(results)
    except Exception:
        return jsonify({"error": "Search failed"}), 500


# -- API: Quote ---------------------------------------------------------------

@app.route("/api/quote/<symbol>")
@cache_response(60)
def api_quote(symbol):
    try:
        info = get_info(symbol)
        quote = {
            "symbol": symbol.upper(),
            "name": safe_get(info, "longName") or safe_get(info, "shortName", symbol),
            "price": safe_get(info, "currentPrice") or safe_get(info, "regularMarketPrice", 0),
            "previousClose": safe_get(info, "previousClose", 0),
            "open": safe_get(info, "open") or safe_get(info, "regularMarketOpen", 0),
            "dayHigh": safe_get(info, "dayHigh") or safe_get(info, "regularMarketDayHigh", 0),
            "dayLow": safe_get(info, "dayLow") or safe_get(info, "regularMarketDayLow", 0),
            "volume": safe_get(info, "volume") or safe_get(info, "regularMarketVolume", 0),
            "avgVolume": safe_get(info, "averageVolume", 0),
            "marketCap": safe_get(info, "marketCap", 0),
            "peRatio": safe_get(info, "trailingPE", 0),
            "forwardPE": safe_get(info, "forwardPE", 0),
            "eps": safe_get(info, "trailingEps", 0),
            "forwardEps": safe_get(info, "forwardEps", 0),
            "dividendYield": dividend_yield_fraction(info),
            "dividendRate": safe_get(info, "dividendRate", 0),
            "beta": safe_get(info, "beta", 0),
            "fiftyTwoWeekHigh": safe_get(info, "fiftyTwoWeekHigh", 0),
            "fiftyTwoWeekLow": safe_get(info, "fiftyTwoWeekLow", 0),
            "fiftyDayAvg": safe_get(info, "fiftyDayAverage", 0),
            "twoHundredDayAvg": safe_get(info, "twoHundredDayAverage", 0),
            "sector": safe_get(info, "sector", "N/A"),
            "industry": safe_get(info, "industry", "N/A"),
            "description": safe_get(info, "longBusinessSummary", ""),
            "currency": safe_get(info, "currency", "USD"),
            "exchange": safe_get(info, "exchange", ""),
            "website": safe_get(info, "website", ""),
            "country": safe_get(info, "country", ""),
            "fullTimeEmployees": safe_get(info, "fullTimeEmployees", 0),
            "earningsGrowth": safe_get(info, "earningsGrowth", 0),
            "revenueGrowth": safe_get(info, "revenueGrowth", 0),
            "profitMargin": safe_get(info, "profitMargins", 0),
            "operatingMargin": safe_get(info, "operatingMargins", 0),
            "returnOnEquity": safe_get(info, "returnOnEquity", 0),
            "debtToEquity": safe_get(info, "debtToEquity", 0),
            "freeCashflow": safe_get(info, "freeCashflow", 0),
            "revenue": safe_get(info, "totalRevenue", 0),
            "grossProfit": safe_get(info, "grossProfits", 0),
            "ebitda": safe_get(info, "ebitda", 0),
            "targetMeanPrice": safe_get(info, "targetMeanPrice", 0),
            "targetHighPrice": safe_get(info, "targetHighPrice", 0),
            "targetLowPrice": safe_get(info, "targetLowPrice", 0),
            "recommendationKey": safe_get(info, "recommendationKey", ""),
            "numberOfAnalysts": safe_get(info, "numberOfAnalystOpinions", 0),
            "payoutRatio": safe_get(info, "payoutRatio", 0),
            "bookValue": safe_get(info, "bookValue", 0),
            "priceToBook": safe_get(info, "priceToBook", 0),
            "currentRatio": safe_get(info, "currentRatio", 0),
            "quickRatio": safe_get(info, "quickRatio", 0),
            "revenuePerShare": safe_get(info, "revenuePerShare", 0),
            "totalCash": safe_get(info, "totalCash", 0),
            "totalDebt": safe_get(info, "totalDebt", 0),
            "enterpriseValue": safe_get(info, "enterpriseValue", 0),
            "pegRatio": peg_ratio(info),
            "sharesOutstanding": safe_get(info, "sharesOutstanding", 0),
            "nextEarningsDate": safe_get(info, "earningsTimestamp", 0),
        }
        price = quote["price"] or 0
        prev = quote["previousClose"] or 0
        quote["change"] = round(price - prev, 2) if price and prev else 0
        quote["changePercent"] = round((price - prev) / prev * 100, 2) if prev else 0
        return jsonify(quote)
    except Exception as e:
        log.exception("Quote error for %s", symbol)
        return jsonify({"error": "Failed to fetch quote"}), 500


# -- API: Price History -------------------------------------------------------

@app.route("/api/history/<symbol>")
@cache_response(600)
def api_history(symbol):
    period = request.args.get("period", "1y")
    interval = request.args.get("interval", "1d")
    try:
        t = get_ticker(symbol)
        df = t.history(period=period, interval=interval)
        if df.empty:
            return jsonify({"error": "No data found"}), 404
        df = df.reset_index()
        df["date"] = df["Date"].dt.strftime("%Y-%m-%d")
        df["timestamp"] = (df["Date"].astype("int64") // 10**6).astype(int)
        records = df.apply(lambda r: {
            "date": r["date"], "timestamp": r["timestamp"],
            "open": round(float(r["Open"]), 2), "high": round(float(r["High"]), 2),
            "low": round(float(r["Low"]), 2), "close": round(float(r["Close"]), 2),
            "volume": int(r["Volume"]),
        }, axis=1).tolist()
        return jsonify(records)
    except Exception:
        return jsonify({"error": "Failed to fetch history"}), 500


# -- API: Fundamentals --------------------------------------------------------

@app.route("/api/fundamentals/<symbol>")
@cache_response(3600)
def api_fundamentals(symbol):
    try:
        t = get_ticker(symbol)

        def df_to_dict(df):
            if df is None or df.empty:
                return {}
            result = {}
            for col in df.columns:
                date_str = col.strftime("%Y-%m-%d") if hasattr(col, "strftime") else str(col)
                col_data = {}
                for idx in df.index:
                    val = df.loc[idx, col]
                    col_data[str(idx)] = float(val) if pd.notna(val) else None
                result[date_str] = col_data
            return result

        attrs = ["financials", "quarterly_financials", "balance_sheet",
                 "quarterly_balance_sheet", "cashflow", "quarterly_cashflow"]

        def fetch_attr(attr):
            try:
                return attr, df_to_dict(getattr(t, attr))
            except Exception:
                return attr, {}

        with ThreadPoolExecutor(max_workers=6) as executor:
            results = dict(executor.map(lambda a: fetch_attr(a), attrs))

        return jsonify({
            "financials": results["financials"],
            "quarterlyFinancials": results["quarterly_financials"],
            "balanceSheet": results["balance_sheet"],
            "quarterlyBalanceSheet": results["quarterly_balance_sheet"],
            "cashflow": results["cashflow"],
            "quarterlyCashflow": results["quarterly_cashflow"],
        })
    except Exception:
        return jsonify({"error": "Failed to fetch fundamentals"}), 500


# -- API: Market Overview -----------------------------------------------------

@app.route("/api/market")
@cache_response(60)
def api_market():
    indices = {
        "^GSPC": "S&P 500",
        "^DJI": "Dow Jones",
        "^IXIC": "NASDAQ",
        "^RUT": "Russell 2000",
        "^VIX": "VIX",
        "^FTSE": "FTSE 100",
        "GC=F": "Gold",
        "CL=F": "Crude Oil",
        "BTC-USD": "Bitcoin",
    }

    def fetch_index(sym, name):
        try:
            info = get_info(sym)
            price = safe_get(info, "regularMarketPrice") or safe_get(info, "currentPrice", 0)
            prev = safe_get(info, "previousClose") or safe_get(info, "regularMarketPreviousClose", 0)
            change = round(price - prev, 2) if price and prev else 0
            change_pct = round((price - prev) / prev * 100, 2) if prev else 0
            return {"symbol": sym, "name": name, "price": price, "change": change, "changePercent": change_pct}
        except Exception:
            return {"symbol": sym, "name": name, "price": 0, "change": 0, "changePercent": 0}

    with ThreadPoolExecutor(max_workers=9) as executor:
        futures = [executor.submit(fetch_index, sym, name) for sym, name in indices.items()]
        results = [f.result() for f in futures]

    return jsonify(results)


# -- API: Compare Stocks ------------------------------------------------------

@app.route("/api/compare")
@cache_response(300)
def api_compare():
    symbols = request.args.get("symbols", "").split(",")
    symbols = [s.strip().upper() for s in symbols if s.strip()]
    if not symbols:
        return jsonify({"error": "No symbols provided"}), 400
    period = request.args.get("period", "1y")

    def fetch_stock(sym):
        try:
            info = get_info(sym)
            t = get_ticker(sym)
            df = t.history(period=period)
            prices = []
            if not df.empty:
                first_close = float(df["Close"].iloc[0])
                for idx, row in df.iterrows():
                    prices.append({
                        "date": idx.strftime("%Y-%m-%d"),
                        "close": round(float(row["Close"]), 2),
                        "normalized": round(float(row["Close"]) / first_close * 100, 2) if first_close else 0,
                    })
            return sym, {
                "name": safe_get(info, "longName") or safe_get(info, "shortName", sym),
                "price": safe_get(info, "currentPrice") or safe_get(info, "regularMarketPrice", 0),
                "marketCap": safe_get(info, "marketCap", 0),
                "peRatio": safe_get(info, "trailingPE", 0),
                "forwardPE": safe_get(info, "forwardPE", 0),
                "eps": safe_get(info, "trailingEps", 0),
                "dividendYield": dividend_yield_fraction(info),
                "beta": safe_get(info, "beta", 0),
                "profitMargin": safe_get(info, "profitMargins", 0),
                "returnOnEquity": safe_get(info, "returnOnEquity", 0),
                "revenueGrowth": safe_get(info, "revenueGrowth", 0),
                "earningsGrowth": safe_get(info, "earningsGrowth", 0),
                "debtToEquity": safe_get(info, "debtToEquity", 0),
                "sector": safe_get(info, "sector", "N/A"),
                "industry": safe_get(info, "industry", "N/A"),
                "fiftyTwoWeekHigh": safe_get(info, "fiftyTwoWeekHigh", 0),
                "fiftyTwoWeekLow": safe_get(info, "fiftyTwoWeekLow", 0),
                "prices": prices,
            }
        except Exception as e:
            return sym, {"error": "Failed to fetch data"}

    with ThreadPoolExecutor(max_workers=min(len(symbols[:5]), 5)) as executor:
        futures = [executor.submit(fetch_stock, sym) for sym in symbols[:5]]
        results = dict(f.result() for f in futures)

    return jsonify(results)


# -- API: Portfolio CRUD (with optional auth) ---------------------------------

@app.route("/api/portfolio", methods=["GET"])
@require_auth
def api_portfolio_list():
    db = get_db()
    user = g.current_user
    rows = db.execute("SELECT * FROM holdings WHERE user_id = ? ORDER BY created_at DESC", (user["user_id"],)).fetchall()
    holdings = [dict(r) for r in rows]

    def enrich_holding(h):
        try:
            info = get_info(h["symbol"])
            h["currentPrice"] = safe_get(info, "currentPrice") or safe_get(info, "regularMarketPrice", 0)
            h["name"] = safe_get(info, "longName") or safe_get(info, "shortName", h["symbol"])
        except Exception:
            h["currentPrice"] = 0
        return h

    if holdings:
        with ThreadPoolExecutor(max_workers=min(len(holdings), 8)) as executor:
            holdings = list(executor.map(enrich_holding, holdings))

    return jsonify(holdings)


@app.route("/api/portfolio", methods=["POST"])
@require_auth
def api_portfolio_add():
    data = request.get_json()
    if not data or not data.get("symbol") or not data.get("shares") or not data.get("buy_price"):
        return jsonify({"error": "symbol, shares, and buy_price are required"}), 400
    try:
        shares = float(data["shares"])
        buy_price = float(data["buy_price"])
    except (ValueError, TypeError):
        return jsonify({"error": "shares and buy_price must be numbers"}), 400
    if shares <= 0 or buy_price <= 0:
        return jsonify({"error": "shares and buy_price must be positive"}), 400
    db = get_db()
    user = g.current_user
    user_id = user["user_id"]
    symbol = data["symbol"].upper().strip()
    name = data.get("name", "")
    if not name:
        try:
            info = get_info(symbol)
            name = safe_get(info, "longName") or safe_get(info, "shortName", symbol)
        except Exception:
            name = symbol
    cursor = db.execute(
        "INSERT INTO holdings (user_id, symbol, name, shares, buy_price, buy_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (user_id, symbol, name, shares, buy_price,
         data.get("buy_date", ""), data.get("notes", ""))
    )
    db.commit()
    return jsonify({"id": cursor.lastrowid, "message": "Holding added"}), 201


@app.route("/api/portfolio/<int:holding_id>", methods=["PUT"])
@require_auth
def api_portfolio_update(holding_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    db = get_db()
    user = g.current_user
    row = db.execute("SELECT id FROM holdings WHERE id = ? AND user_id = ?", (holding_id, user["user_id"])).fetchone()
    if not row:
        return jsonify({"error": "Holding not found"}), 404
    fields = []
    values = []
    for key in ("symbol", "name", "shares", "buy_price", "buy_date", "notes"):
        if key in data:
            fields.append(f"{key} = ?")
            values.append(data[key])
    if not fields:
        return jsonify({"error": "No valid fields to update"}), 400
    values.append(holding_id)
    db.execute(f"UPDATE holdings SET {', '.join(fields)} WHERE id = ?", values)
    db.commit()
    return jsonify({"message": "Holding updated"})


@app.route("/api/portfolio/<int:holding_id>", methods=["DELETE"])
@require_auth
def api_portfolio_delete(holding_id):
    db = get_db()
    user = g.current_user
    db.execute("DELETE FROM holdings WHERE id = ? AND user_id = ?", (holding_id, user["user_id"]))
    db.commit()
    return jsonify({"message": "Holding deleted"})


# -- API: Watchlist CRUD (with optional auth) ---------------------------------

@app.route("/api/watchlist", methods=["GET"])
@require_auth
def api_watchlist_list():
    db = get_db()
    user = g.current_user
    rows = db.execute("SELECT * FROM watchlist WHERE user_id = ? ORDER BY added_at DESC", (user["user_id"],)).fetchall()
    items = [dict(r) for r in rows]

    def enrich_watchlist_item(item):
        try:
            info = get_info(item["symbol"])
            item["price"] = safe_get(info, "currentPrice") or safe_get(info, "regularMarketPrice", 0)
            prev = safe_get(info, "previousClose", 0)
            item["change"] = round(item["price"] - prev, 2) if item["price"] and prev else 0
            item["changePercent"] = round((item["price"] - prev) / prev * 100, 2) if prev else 0
        except Exception:
            item["price"] = 0
            item["change"] = 0
            item["changePercent"] = 0
        return item

    if items:
        with ThreadPoolExecutor(max_workers=min(len(items), 8)) as executor:
            items = list(executor.map(enrich_watchlist_item, items))

    return jsonify(items)


@app.route("/api/watchlist", methods=["POST"])
@require_auth
def api_watchlist_add():
    data = request.get_json()
    if not data or not data.get("symbol"):
        return jsonify({"error": "symbol is required"}), 400
    symbol = data["symbol"].upper().strip()
    name = data.get("name", "")
    if not name:
        try:
            info = get_info(symbol)
            name = safe_get(info, "longName") or safe_get(info, "shortName", symbol)
        except Exception:
            name = symbol
    db = get_db()
    user = g.current_user
    user_id = user["user_id"]
    try:
        db.execute(
            "INSERT OR IGNORE INTO watchlist (user_id, symbol, name) VALUES (?, ?, ?)",
            (user_id, symbol, name)
        )
        db.commit()
    except Exception:
        pass
    return jsonify({"message": f"{symbol} added to watchlist"}), 201


@app.route("/api/watchlist/<symbol>", methods=["DELETE"])
@require_auth
def api_watchlist_delete(symbol):
    db = get_db()
    user = g.current_user
    db.execute("DELETE FROM watchlist WHERE symbol = ? AND user_id = ?", (symbol.upper(), user["user_id"]))
    db.commit()
    return jsonify({"message": f"{symbol} removed from watchlist"})


# -- API: Technical Indicators ------------------------------------------------

@app.route("/api/technicals/<symbol>")
@cache_response(300)
def api_technicals(symbol):
    period = request.args.get("period", "1y")
    try:
        t = get_ticker(symbol)
        df = t.history(period=period)
        if df.empty:
            return jsonify({"error": "No data"}), 404

        close = df["Close"]

        df["SMA20"] = close.rolling(window=20).mean()
        df["SMA50"] = close.rolling(window=50).mean()
        df["SMA200"] = close.rolling(window=200).mean()

        df["EMA12"] = close.ewm(span=12, adjust=False).mean()
        df["EMA26"] = close.ewm(span=26, adjust=False).mean()

        df["MACD"] = df["EMA12"] - df["EMA26"]
        df["Signal"] = df["MACD"].ewm(span=9, adjust=False).mean()
        df["MACD_Hist"] = df["MACD"] - df["Signal"]

        delta = close.diff()
        gain = delta.where(delta > 0, 0).ewm(alpha=1/14, min_periods=14, adjust=False).mean()
        loss = (-delta.where(delta < 0, 0)).ewm(alpha=1/14, min_periods=14, adjust=False).mean()
        rs = gain / loss
        df["RSI"] = 100 - (100 / (1 + rs))

        df["BB_Mid"] = close.rolling(window=20).mean()
        bb_std = close.rolling(window=20).std()
        df["BB_Upper"] = df["BB_Mid"] + 2 * bb_std
        df["BB_Lower"] = df["BB_Mid"] - 2 * bb_std

        records = []
        for idx, row in df.iterrows():
            r = {"date": idx.strftime("%Y-%m-%d")}
            for col in ["Close", "Volume", "SMA20", "SMA50", "SMA200",
                         "EMA12", "EMA26", "MACD", "Signal", "MACD_Hist",
                         "RSI", "BB_Mid", "BB_Upper", "BB_Lower"]:
                val = row.get(col) if col in row.index else None
                r[col] = round(float(val), 4) if pd.notna(val) else None
            records.append(r)

        return jsonify(records)
    except Exception:
        return jsonify({"error": "Failed to fetch technicals"}), 500


@app.route("/api/score/<symbol>")
@cache_response(1800)
def api_score(symbol):
    try:
        info = get_info(symbol)

        scores = {}
        total_weight = 0
        total_score = 0

        # Profitability (weight: 25)
        profit_score = 0
        profit_factors = 0
        pm = safe_get(info, "profitMargins", 0)
        if pm:
            profit_factors += 1
            if pm > 0.2:
                profit_score += 10
            elif pm > 0.1:
                profit_score += 7
            elif pm > 0.05:
                profit_score += 5
            elif pm > 0:
                profit_score += 3
            else:
                profit_score += 1

        roe = safe_get(info, "returnOnEquity", 0)
        if roe:
            profit_factors += 1
            if roe > 0.2:
                profit_score += 10
            elif roe > 0.15:
                profit_score += 8
            elif roe > 0.1:
                profit_score += 6
            elif roe > 0:
                profit_score += 3
            else:
                profit_score += 1

        om = safe_get(info, "operatingMargins", 0)
        if om:
            profit_factors += 1
            if om > 0.25:
                profit_score += 10
            elif om > 0.15:
                profit_score += 7
            elif om > 0.05:
                profit_score += 5
            elif om > 0:
                profit_score += 3
            else:
                profit_score += 1

        if profit_factors > 0:
            scores["profitability"] = round(profit_score / profit_factors, 1)
            total_score += scores["profitability"] * 25
            total_weight += 25

        # Growth (weight: 20)
        growth_score = 0
        growth_factors = 0
        rg = safe_get(info, "revenueGrowth", 0)
        if rg:
            growth_factors += 1
            if rg > 0.25:
                growth_score += 10
            elif rg > 0.15:
                growth_score += 8
            elif rg > 0.05:
                growth_score += 6
            elif rg > 0:
                growth_score += 4
            else:
                growth_score += 2

        eg = safe_get(info, "earningsGrowth", 0)
        if eg:
            growth_factors += 1
            if eg > 0.25:
                growth_score += 10
            elif eg > 0.15:
                growth_score += 8
            elif eg > 0.05:
                growth_score += 6
            elif eg > 0:
                growth_score += 4
            else:
                growth_score += 2

        if growth_factors > 0:
            scores["growth"] = round(growth_score / growth_factors, 1)
            total_score += scores["growth"] * 20
            total_weight += 20

        # Valuation (weight: 20)
        val_score = 0
        val_factors = 0
        pe = safe_get(info, "trailingPE", 0)
        if pe and pe > 0:
            val_factors += 1
            if pe < 15:
                val_score += 10
            elif pe < 20:
                val_score += 8
            elif pe < 30:
                val_score += 6
            elif pe < 50:
                val_score += 4
            else:
                val_score += 2

        pb = safe_get(info, "priceToBook", 0)
        if pb and pb > 0:
            val_factors += 1
            if pb < 1:
                val_score += 10
            elif pb < 3:
                val_score += 8
            elif pb < 5:
                val_score += 6
            elif pb < 10:
                val_score += 4
            else:
                val_score += 2

        peg = peg_ratio(info)
        if peg and peg > 0:
            val_factors += 1
            if peg < 1:
                val_score += 10
            elif peg < 1.5:
                val_score += 8
            elif peg < 2:
                val_score += 6
            elif peg < 3:
                val_score += 4
            else:
                val_score += 2

        if val_factors > 0:
            scores["valuation"] = round(val_score / val_factors, 1)
            total_score += scores["valuation"] * 20
            total_weight += 20

        # Financial Health (weight: 20)
        health_score = 0
        health_factors = 0
        de = safe_get(info, "debtToEquity")
        if de is not None and de > 0:
            health_factors += 1
            if de < 30:
                health_score += 10
            elif de < 60:
                health_score += 8
            elif de < 100:
                health_score += 6
            elif de < 150:
                health_score += 4
            else:
                health_score += 2

        cr = safe_get(info, "currentRatio", 0)
        if cr and cr > 0:
            health_factors += 1
            if cr > 2:
                health_score += 10
            elif cr > 1.5:
                health_score += 8
            elif cr > 1:
                health_score += 6
            elif cr > 0.5:
                health_score += 4
            else:
                health_score += 2

        fcf = safe_get(info, "freeCashflow", 0)
        if fcf:
            health_factors += 1
            if fcf > 0:
                health_score += 8
            else:
                health_score += 3

        if health_factors > 0:
            scores["financialHealth"] = round(health_score / health_factors, 1)
            total_score += scores["financialHealth"] * 20
            total_weight += 20

        # Momentum (weight: 15)
        momentum_score = 0
        momentum_factors = 0
        try:
            t = get_ticker(symbol)
            df = t.history(period="6mo")
            if not df.empty and len(df) > 20:
                current = float(df["Close"].iloc[-1])
                sma50 = float(df["Close"].tail(50).mean()) if len(df) >= 50 else float(df["Close"].mean())
                sma20 = float(df["Close"].tail(20).mean())

                momentum_factors += 1
                if current > sma20 > sma50:
                    momentum_score += 10
                elif current > sma50:
                    momentum_score += 7
                elif current > sma20:
                    momentum_score += 5
                else:
                    momentum_score += 3

                six_mo_return = (current - float(df["Close"].iloc[0])) / float(df["Close"].iloc[0])
                momentum_factors += 1
                if six_mo_return > 0.2:
                    momentum_score += 10
                elif six_mo_return > 0.1:
                    momentum_score += 8
                elif six_mo_return > 0:
                    momentum_score += 6
                elif six_mo_return > -0.1:
                    momentum_score += 4
                else:
                    momentum_score += 2
        except Exception:
            pass

        if momentum_factors > 0:
            scores["momentum"] = round(momentum_score / momentum_factors, 1)
            total_score += scores["momentum"] * 15
            total_weight += 15

        overall = round(total_score / total_weight, 1) if total_weight > 0 else 0

        if overall >= 8:
            rating = "Strong Buy"
        elif overall >= 6.5:
            rating = "Buy"
        elif overall >= 5:
            rating = "Hold"
        elif overall >= 3.5:
            rating = "Sell"
        else:
            rating = "Strong Sell"

        return jsonify({
            "symbol": symbol.upper(),
            "overallScore": overall,
            "rating": rating,
            "scores": scores,
            "details": {
                "profitMargin": safe_get(info, "profitMargins", 0),
                "returnOnEquity": safe_get(info, "returnOnEquity", 0),
                "operatingMargin": safe_get(info, "operatingMargins", 0),
                "revenueGrowth": safe_get(info, "revenueGrowth", 0),
                "earningsGrowth": safe_get(info, "earningsGrowth", 0),
                "peRatio": safe_get(info, "trailingPE", 0),
                "priceToBook": safe_get(info, "priceToBook", 0),
                "pegRatio": peg_ratio(info),
                "debtToEquity": safe_get(info, "debtToEquity", 0),
                "currentRatio": safe_get(info, "currentRatio", 0),
                "freeCashflow": safe_get(info, "freeCashflow", 0),
            }
        })
    except Exception as e:
        return jsonify({"error": "Server error"}), 500


# -- API: SEC Filings ---------------------------------------------------------

_sec_tickers_cache = None
_sec_tickers_cache_time = 0
_SEC_TICKERS_TTL = 86400


def _get_sec_cik(symbol):
    global _sec_tickers_cache, _sec_tickers_cache_time
    now = datetime.now(timezone.utc).timestamp()
    if not _sec_tickers_cache or (now - _sec_tickers_cache_time) > _SEC_TICKERS_TTL:
        url = "https://www.sec.gov/files/company_tickers.json"
        req = urllib.request.Request(url, headers={
            "User-Agent": "InvestorHub admin@investorhub.app",
            "Accept": "application/json",
        })
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
        lookup = {}
        for entry in data.values():
            ticker = entry.get("ticker", "").upper()
            if ticker:
                lookup[ticker] = {
                    "cik": str(entry["cik_str"]).zfill(10),
                    "name": entry.get("title", ""),
                }
        _sec_tickers_cache = lookup
        _sec_tickers_cache_time = now
    return _sec_tickers_cache.get(symbol.upper())


@app.route("/api/sec-filings/<symbol>")
@cache_response(3600)
def api_sec_filings(symbol):
    symbol = symbol.upper().strip()
    try:
        company = _get_sec_cik(symbol)
        if not company:
            return jsonify({"error": f"No SEC filings found for {symbol}"}), 404

        cik = company["cik"]
        url = f"https://data.sec.gov/submissions/CIK{cik}.json"
        req = urllib.request.Request(url, headers={
            "User-Agent": "InvestorHub admin@investorhub.app",
            "Accept": "application/json",
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            submissions = json.loads(resp.read().decode())

        recent = submissions.get("filings", {}).get("recent", {})
        forms = recent.get("form", [])
        dates = recent.get("filingDate", [])
        accessions = recent.get("accessionNumber", [])
        descriptions = recent.get("primaryDocDescription", [])
        docs = recent.get("primaryDocument", [])

        important_forms = {"10-K", "10-Q", "8-K", "DEF 14A", "20-F", "6-K", "S-1"}
        cik_num = cik.lstrip("0")
        filings = []
        for i in range(min(len(forms), 100)):
            form = forms[i] if i < len(forms) else ""
            if form not in important_forms:
                continue
            accession = accessions[i].replace("-", "") if i < len(accessions) else ""
            doc = docs[i] if i < len(docs) else ""
            filing_url = f"https://www.sec.gov/Archives/edgar/data/{cik_num}/{accession}/{doc}" if doc else ""
            filings.append({
                "form": form,
                "filingDate": dates[i] if i < len(dates) else "",
                "description": descriptions[i] if i < len(descriptions) else form,
                "url": filing_url,
                "accessionNumber": accessions[i] if i < len(accessions) else "",
            })
            if len(filings) >= 25:
                break

        return jsonify({
            "symbol": symbol,
            "cik": cik,
            "companyName": company["name"],
            "filings": filings,
            "edgarUrl": f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type=&dateb=&owner=include&count=40&search_text=&action=getcompany",
        })
    except Exception as e:
        return jsonify({"error": "Server error"}), 500


# -- API: Sector Peers --------------------------------------------------------

@app.route("/api/peers/<symbol>")
@cache_response(1800)
def api_peers(symbol):
    try:
        info = get_info(symbol.upper())
        sector = safe_get(info, "sector", "")
        industry = safe_get(info, "industry", "")
        if not sector:
            return jsonify({"peers": [], "sector": "", "industry": ""})

        sector_peers = {
            "Technology": ["AAPL", "MSFT", "GOOGL", "META", "NVDA", "AMZN", "CRM", "ORCL", "ADBE", "INTC", "AMD", "CSCO", "IBM", "AVGO", "QCOM", "PLTR", "SNOW", "NET", "CRWD", "DDOG"],
            "Communication Services": ["GOOGL", "META", "NFLX", "DIS", "SPOT", "SNAP", "ZM"],
            "Consumer Cyclical": ["AMZN", "TSLA", "HD", "NKE", "MCD", "SBUX", "TGT", "LOW", "BKNG", "ABNB", "RIVN"],
            "Consumer Defensive": ["WMT", "COST", "KO", "PEP", "PG"],
            "Financial Services": ["JPM", "BAC", "GS", "MS", "WFC", "V", "MA", "SOFI", "HOOD", "COIN"],
            "Healthcare": ["JNJ", "PFE", "UNH", "MRNA", "LLY", "ABBV", "TMO", "ABT"],
            "Energy": ["XOM", "CVX", "COP", "SLB", "EOG"],
            "Industrials": ["BA", "CAT", "HON", "GE", "UPS", "RTX", "DE"],
            "Real Estate": ["PLD", "AMT", "CCI", "SPG", "O"],
            "Utilities": ["NEE", "DUK", "SO", "D", "AEP"],
            "Basic Materials": ["LIN", "APD", "ECL", "SHW", "NEM", "FCX"],
        }

        candidates = sector_peers.get(sector, [])
        sym_upper = symbol.upper()
        candidates = [c for c in candidates if c != sym_upper][:6]

        peers = []

        def fetch_peer(sym):
            try:
                pi = get_info(sym)
                return {
                    "symbol": sym,
                    "name": safe_get(pi, "longName") or safe_get(pi, "shortName", sym),
                    "price": safe_get(pi, "currentPrice") or safe_get(pi, "regularMarketPrice", 0),
                    "changePercent": round(
                        ((safe_get(pi, "currentPrice") or safe_get(pi, "regularMarketPrice", 0))
                         - (safe_get(pi, "previousClose", 0) or 0))
                        / (safe_get(pi, "previousClose", 1) or 1) * 100, 2
                    ),
                    "marketCap": safe_get(pi, "marketCap", 0),
                    "peRatio": safe_get(pi, "trailingPE", 0),
                    "sector": safe_get(pi, "sector", ""),
                    "industry": safe_get(pi, "industry", ""),
                }
            except Exception:
                return None

        with ThreadPoolExecutor(max_workers=min(len(candidates), 6)) as executor:
            results = list(executor.map(fetch_peer, candidates))

        peers = [r for r in results if r is not None]

        return jsonify({
            "symbol": sym_upper,
            "sector": sector,
            "industry": industry,
            "peers": peers,
        })
    except Exception as e:
        return jsonify({"error": "Server error"}), 500


# -- API: Returns & Risk ------------------------------------------------------

@app.route("/api/returns/<symbol>")
@cache_response(600)
def api_returns(symbol):
    """Multi-timeframe price returns plus risk metrics (volatility, drawdown,
    Sharpe, 52-week range position) — the numbers investors check first."""
    try:
        t = get_ticker(symbol)
        # 10y window so the 5Y lookback always resolves; risk metrics below use
        # their own trailing slices.
        df = t.history(period="10y", interval="1d")
        if df.empty:
            return jsonify({"error": "No data"}), 404
        close = df["Close"].dropna()
        if len(close) < 2:
            return jsonify({"error": "No data"}), 404

        last = float(close.iloc[-1])
        idx = close.index
        now = idx[-1]

        def ret_for(delta):
            past = close[close.index <= now - delta]
            if len(past) == 0:
                return None
            base = float(past.iloc[-1])
            return round((last / base - 1) * 100, 2) if base else None

        returns = {
            "1W": ret_for(timedelta(days=7)),
            "1M": ret_for(timedelta(days=30)),
            "3M": ret_for(timedelta(days=91)),
            "6M": ret_for(timedelta(days=182)),
            "1Y": ret_for(timedelta(days=365)),
            "3Y": ret_for(timedelta(days=365 * 3)),
            "5Y": ret_for(timedelta(days=365 * 5)),
        }
        year_start = pd.Timestamp(year=now.year, month=1, day=1, tz=idx.tz)
        prior = close[close.index < year_start]
        base_ytd = float(prior.iloc[-1]) if len(prior) else float(close.iloc[0])
        returns["YTD"] = round((last / base_ytd - 1) * 100, 2) if base_ytd else None

        one_y = close[close.index >= now - timedelta(days=365)]
        three_y = close[close.index >= now - timedelta(days=365 * 3)]

        # Annualized volatility from the last year of daily returns.
        daily_1y = one_y.pct_change().dropna()
        vol = round(float(daily_1y.std() * math.sqrt(252) * 100), 2) if len(daily_1y) > 20 else None
        # Worst peak-to-trough over the last three years.
        dd = three_y / three_y.cummax() - 1.0
        max_dd = round(float(dd.min() * 100), 2) if len(dd) else None

        hi = float(one_y.max()) if len(one_y) else last
        lo = float(one_y.min()) if len(one_y) else last
        pos = round((last - lo) / (hi - lo) * 100, 1) if hi > lo else 50.0
        sharpe = None
        if len(daily_1y) > 20 and daily_1y.std() > 0:
            sharpe = round(float(daily_1y.mean() / daily_1y.std() * math.sqrt(252)), 2)

        return jsonify({
            "symbol": symbol.upper(),
            "returns": returns,
            "risk": {
                "volatility": vol,
                "maxDrawdown": max_dd,
                "sharpe": sharpe,
                "high52": round(hi, 2),
                "low52": round(lo, 2),
                "rangePosition": pos,
            },
        })
    except Exception:
        log.exception("returns error %s", symbol)
        return jsonify({"error": "Failed to compute returns"}), 500


# -- API: Dividends -----------------------------------------------------------

@app.route("/api/dividends/<symbol>")
@cache_response(3600)
def api_dividends(symbol):
    """Dividend history, growth (CAGR), payout sustainability and streak."""
    try:
        t = get_ticker(symbol)
        info = get_info(symbol)
        price = safe_get(info, "currentPrice") or safe_get(info, "regularMarketPrice", 0)
        result = {
            "symbol": symbol.upper(),
            "hasDividend": False,
            "yield": dividend_yield_fraction(info, price),
            "rate": safe_get(info, "dividendRate", 0),
            "payoutRatio": safe_get(info, "payoutRatio", 0),
            "fiveYearAvgYield": safe_get(info, "fiveYearAvgDividendYield", 0),
            "history": [],
            "cagr": None,
            "growth5y": None,
            "streak": 0,
        }
        divs = t.dividends
        if divs is None or len(divs) == 0:
            return jsonify(result)
        result["hasDividend"] = True

        by_year = defaultdict(float)
        for ts, val in divs.items():
            by_year[ts.year] += float(val)
        years = sorted(by_year)
        result["history"] = [{"year": y, "amount": round(by_year[y], 4)} for y in years][-12:]

        this_year = datetime.now(timezone.utc).year
        complete = [y for y in years if y < this_year]
        if len(complete) >= 2:
            n = complete[-1] - complete[0]
            first, latest = by_year[complete[0]], by_year[complete[-1]]
            if first > 0 and n > 0:
                result["cagr"] = round(((latest / first) ** (1 / n) - 1) * 100, 2)
            recent = [y for y in complete if y >= complete[-1] - 5]
            if len(recent) >= 2 and by_year[recent[0]] > 0:
                rn = recent[-1] - recent[0]
                if rn > 0:
                    result["growth5y"] = round(((by_year[recent[-1]] / by_year[recent[0]]) ** (1 / rn) - 1) * 100, 2)
            streak = 0
            for i in range(len(complete) - 1, 0, -1):
                if by_year[complete[i]] >= by_year[complete[i - 1]]:
                    streak += 1
                else:
                    break
            result["streak"] = streak
        return jsonify(result)
    except Exception:
        log.exception("dividends error %s", symbol)
        return jsonify({"error": "Failed to fetch dividends"}), 500


# -- API: Analyst Coverage ----------------------------------------------------

@app.route("/api/analysts/<symbol>")
@cache_response(1800)
def api_analysts(symbol):
    """Analyst consensus: price targets with implied upside and the buy/hold/sell
    distribution (the breadth behind a single 'buy' rating)."""
    try:
        info = get_info(symbol)
        t = get_ticker(symbol)
        price = safe_get(info, "currentPrice") or safe_get(info, "regularMarketPrice", 0)
        target = safe_get(info, "targetMeanPrice", 0)
        result = {
            "symbol": symbol.upper(),
            "price": price,
            "targetMean": target,
            "targetHigh": safe_get(info, "targetHighPrice", 0),
            "targetLow": safe_get(info, "targetLowPrice", 0),
            "targetMedian": safe_get(info, "targetMedianPrice", 0),
            "upside": round((target - price) / price * 100, 2) if price and target else None,
            "recommendationKey": safe_get(info, "recommendationKey", ""),
            "recommendationMean": safe_get(info, "recommendationMean", 0),
            "numberOfAnalysts": safe_get(info, "numberOfAnalystOpinions", 0),
            "distribution": None,
        }
        try:
            rec = t.recommendations
            if rec is not None and not rec.empty:
                if "period" in rec.columns:
                    cur = rec[rec["period"] == "0m"]
                    row = (cur.iloc[0] if len(cur) else rec.iloc[0]).to_dict()
                else:
                    row = rec.iloc[0].to_dict()
                dist = {k: int(row.get(k, 0) or 0) for k in ["strongBuy", "buy", "hold", "sell", "strongSell"]}
                if sum(dist.values()) > 0:
                    result["distribution"] = dist
        except Exception:
            pass
        return jsonify(result)
    except Exception:
        log.exception("analysts error %s", symbol)
        return jsonify({"error": "Failed to fetch analyst data"}), 500


# -- API: Valuation / Fair Value ----------------------------------------------

@app.route("/api/valuation/<symbol>")
@cache_response(1800)
def api_valuation(symbol):
    """Transparent fair-value estimate blending analyst consensus, an earnings-
    growth multiple (PEG=1, Lynch) and a 5-year DCF. Each method shows its
    assumptions so the user can judge it rather than trust a black box."""
    try:
        info = get_info(symbol)
        price = safe_get(info, "currentPrice") or safe_get(info, "regularMarketPrice", 0)
        methods = []

        target = safe_get(info, "targetMeanPrice", 0)
        if target and target > 0:
            n = safe_get(info, "numberOfAnalystOpinions", 0)
            methods.append({"method": "Analyst Consensus", "fairValue": round(target, 2),
                            "detail": f"{n} analyst targets" if n else "Mean price target"})

        fwd_eps = safe_get(info, "forwardEps", 0)
        growth = safe_get(info, "earningsGrowth", 0) or safe_get(info, "revenueGrowth", 0) or 0
        if fwd_eps and fwd_eps > 0 and growth and growth > 0:
            fair_pe = min(max(growth * 100, 8), 35)
            methods.append({"method": "Earnings Growth", "fairValue": round(fwd_eps * fair_pe, 2),
                            "detail": f"Fwd EPS ${fwd_eps:.2f} x {fair_pe:.0f} (PEG 1.0)"})

        fcf = safe_get(info, "freeCashflow", 0)
        shares = safe_get(info, "sharesOutstanding", 0)
        total_debt = safe_get(info, "totalDebt", 0) or 0
        total_cash = safe_get(info, "totalCash", 0) or 0
        assumptions = None
        if fcf and fcf > 0 and shares and shares > 0:
            g = max(min(growth or 0.05, 0.15), 0.02)
            disc, term = 0.09, 0.025
            pv, cf = 0.0, fcf
            for yr in range(1, 6):
                cf *= (1 + g)
                pv += cf / ((1 + disc) ** yr)
            pv += cf * (1 + term) / (disc - term) / ((1 + disc) ** 5)
            fair = (pv - total_debt + total_cash) / shares
            if fair > 0:
                methods.append({"method": "DCF (5Y + terminal)", "fairValue": round(fair, 2),
                                "detail": f"{g * 100:.0f}% growth, 9% discount"})
                assumptions = {"growth": round(g * 100, 1), "discount": 9.0, "terminal": 2.5}

        composite = None
        vals = [m["fairValue"] for m in methods if m["fairValue"] > 0]
        if vals:
            composite = round(sum(vals) / len(vals), 2)
        upside = round((composite - price) / price * 100, 2) if composite and price else None
        verdict = "—"
        if upside is not None:
            verdict = "Undervalued" if upside > 12 else "Overvalued" if upside < -12 else "Fairly Valued"

        return jsonify({
            "symbol": symbol.upper(),
            "price": price,
            "fairValue": composite,
            "upside": upside,
            "verdict": verdict,
            "methods": methods,
            "currentPE": safe_get(info, "trailingPE", 0),
            "forwardPE": safe_get(info, "forwardPE", 0),
            "pegRatio": peg_ratio(info),
            "priceToBook": safe_get(info, "priceToBook", 0),
            "assumptions": assumptions,
        })
    except Exception:
        log.exception("valuation error %s", symbol)
        return jsonify({"error": "Failed to compute valuation"}), 500


# -- API: Earnings ------------------------------------------------------------

@app.route("/api/earnings/<symbol>")
@cache_response(3600)
def api_earnings(symbol):
    """Earnings beat/miss history and the next reporting date."""
    try:
        t = get_ticker(symbol)
        info = get_info(symbol)
        result = {"symbol": symbol.upper(), "nextDate": safe_get(info, "earningsTimestamp", 0), "history": []}
        try:
            ed = t.get_earnings_dates(limit=12)
            if ed is not None and not ed.empty:
                hist = []
                for ts, row in ed.iterrows():
                    est = row.get("EPS Estimate")
                    act = row.get("Reported EPS")
                    surp = row.get("Surprise(%)")
                    # yfinance's "Surprise(%)" column is already expressed in percent.
                    s = None if surp is None or pd.isna(surp) else round(float(surp), 1)
                    hist.append({
                        "date": ts.strftime("%Y-%m-%d"),
                        "epsEstimate": None if est is None or pd.isna(est) else round(float(est), 2),
                        "epsActual": None if act is None or pd.isna(act) else round(float(act), 2),
                        "surprisePct": s,
                    })
                result["history"] = hist
        except Exception:
            pass
        return jsonify(result)
    except Exception:
        log.exception("earnings error %s", symbol)
        return jsonify({"error": "Failed to fetch earnings"}), 500


# -- API: Portfolio Analytics -------------------------------------------------

@app.route("/api/portfolio/analytics")
@require_auth
def api_portfolio_analytics():
    """Portfolio-level intelligence: sector mix, income, beta, concentration and
    a benchmark read — the context a P&L table alone can't give."""
    db = get_db()
    user = g.current_user
    rows = db.execute("SELECT * FROM holdings WHERE user_id = ?", (user["user_id"],)).fetchall()
    holdings = [dict(r) for r in rows]
    if not holdings:
        return jsonify({"holdings": 0})

    def enrich(h):
        try:
            info = get_info(h["symbol"])
            price = safe_get(info, "currentPrice") or safe_get(info, "regularMarketPrice", 0) or 0
            return {
                "symbol": h["symbol"], "shares": h["shares"], "buy_price": h["buy_price"],
                "price": price, "prevClose": safe_get(info, "previousClose", 0) or price,
                "sector": safe_get(info, "sector", "Other") or "Other",
                "beta": safe_get(info, "beta", 0) or 0,
                "divRate": safe_get(info, "dividendRate", 0) or 0,
            }
        except Exception:
            return {"symbol": h["symbol"], "shares": h["shares"], "buy_price": h["buy_price"],
                    "price": 0, "prevClose": 0, "sector": "Other", "beta": 0, "divRate": 0}

    with ThreadPoolExecutor(max_workers=min(len(holdings), 8)) as ex:
        en = list(ex.map(enrich, holdings))

    total_val = sum(e["price"] * e["shares"] for e in en)
    total_cost = sum(e["buy_price"] * e["shares"] for e in en)
    prev_val = sum(e["prevClose"] * e["shares"] for e in en)
    day_change = total_val - prev_val
    annual_income = sum(e["divRate"] * e["shares"] for e in en)

    sectors = defaultdict(float)
    for e in en:
        sectors[e["sector"]] += e["price"] * e["shares"]
    sector_alloc = [{"sector": s, "value": round(v, 2), "pct": round(v / total_val * 100, 1) if total_val else 0}
                    for s, v in sorted(sectors.items(), key=lambda x: -x[1])]

    weights = [e["price"] * e["shares"] / total_val for e in en] if total_val else []
    pbeta = sum(w * e["beta"] for w, e in zip(weights, en)) if weights else 0
    hhi = round(sum((w * 100) ** 2 for w in weights), 0) if weights else 0
    top_weight = round(max(weights) * 100, 1) if weights else 0

    for e in en:
        e["retPct"] = ((e["price"] - e["buy_price"]) / e["buy_price"] * 100) if e["buy_price"] else 0
    best = max(en, key=lambda x: x["retPct"])
    worst = min(en, key=lambda x: x["retPct"])

    spy_day = None
    try:
        spy = get_info("SPY")
        sp = safe_get(spy, "currentPrice") or safe_get(spy, "regularMarketPrice", 0)
        spc = safe_get(spy, "previousClose", 0)
        if sp and spc:
            spy_day = round((sp - spc) / spc * 100, 2)
    except Exception:
        pass

    return jsonify({
        "holdings": len(en),
        "totalValue": round(total_val, 2),
        "totalCost": round(total_cost, 2),
        "dayChange": round(day_change, 2),
        "dayChangePct": round(day_change / prev_val * 100, 2) if prev_val else 0,
        "annualIncome": round(annual_income, 2),
        "portfolioYield": round(annual_income / total_val * 100, 2) if total_val else 0,
        "yieldOnCost": round(annual_income / total_cost * 100, 2) if total_cost else 0,
        "beta": round(pbeta, 2),
        "hhi": hhi,
        "topWeight": top_weight,
        "diversification": "Well diversified" if hhi < 1500 else "Moderately concentrated" if hhi < 2500 else "Highly concentrated",
        "sectorAllocation": sector_alloc,
        "best": {"symbol": best["symbol"], "retPct": round(best["retPct"], 2)},
        "worst": {"symbol": worst["symbol"], "retPct": round(worst["retPct"], 2)},
        "spyDayChange": spy_day,
    })


# -- API: Market Movers -------------------------------------------------------

_MOVERS_UNIVERSE = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AVGO", "JPM", "V",
    "WMT", "UNH", "XOM", "MA", "PG", "JNJ", "HD", "COST", "ORCL", "BAC",
    "KO", "PEP", "NFLX", "AMD", "CRM", "ADBE", "DIS", "INTC", "QCOM", "PLTR",
    "COIN", "UBER", "BA", "PFE", "CSCO", "NKE", "SBUX", "T", "F", "GM",
]


@app.route("/api/movers")
@cache_response(120)
def api_movers():
    """Top gainers/losers across a liquid large-cap universe, computed from one
    batched download so the dashboard surfaces 'what's moving' for free."""
    try:
        data = yf.download(_MOVERS_UNIVERSE, period="2d", interval="1d",
                           group_by="ticker", threads=True, progress=False)
        moves = []
        for sym in _MOVERS_UNIVERSE:
            try:
                closes = data[sym]["Close"].dropna()
                if len(closes) >= 2:
                    last, prev = float(closes.iloc[-1]), float(closes.iloc[-2])
                    if prev:
                        moves.append({"symbol": sym, "price": round(last, 2),
                                      "changePercent": round((last - prev) / prev * 100, 2)})
            except Exception:
                continue
        moves.sort(key=lambda x: x["changePercent"], reverse=True)
        losers = moves[-6:][::-1] if len(moves) >= 6 else moves[::-1]
        return jsonify({"gainers": moves[:6], "losers": losers})
    except Exception:
        log.exception("movers error")
        return jsonify({"gainers": [], "losers": []})


# -- Run ----------------------------------------------------------------------

with app.app_context():
    init_db()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8050))
    app.run(debug=True, port=port)
