import gzip
import json
import logging
import sqlite3
import os
import urllib.parse
import urllib.request
from collections import OrderedDict
from datetime import datetime, timedelta
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
    "http://localhost:5000",
    "http://localhost:8050",
    "http://127.0.0.1:5000",
    "http://127.0.0.1:8050",
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
        "exp": datetime.utcnow() + timedelta(days=30),
        "iat": datetime.utcnow(),
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
        if (datetime.utcnow().timestamp() - entry[1]) > ttl:
            self._data.pop(key, None)
            return None
        self._data.move_to_end(key)
        return entry[0]

    def put(self, key, value):
        self._data[key] = (value, datetime.utcnow().timestamp())
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
@cache_response(30)
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
            "dividendYield": safe_get(info, "dividendYield", 0),
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
            "pegRatio": safe_get(info, "pegRatio", 0),
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
@cache_response(60)
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
@cache_response(300)
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
@cache_response(60)
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
                "dividendYield": safe_get(info, "dividendYield", 0),
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
@cache_response(60)
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
@cache_response(300)
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

        peg = safe_get(info, "pegRatio", 0)
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
                "pegRatio": safe_get(info, "pegRatio", 0),
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
    now = datetime.utcnow().timestamp()
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
@cache_response(120)
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
@cache_response(300)
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


# -- Run ----------------------------------------------------------------------

with app.app_context():
    init_db()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8050))
    app.run(debug=True, port=port)
