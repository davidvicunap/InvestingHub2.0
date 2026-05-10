import json
import sqlite3
import os
import re
import hashlib
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
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

app = Flask(__name__)
CORS(app)
app.config["DATABASE"] = os.environ.get("DATABASE_PATH", os.path.join(app.root_path, "portfolio.db"))
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "investorhub-dev-secret-key-change-in-prod")

sentiment_analyzer = SentimentIntensityAnalyzer()


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


# -- Helper: cache yfinance Ticker objects (5-min TTL) -----------------------

_ticker_cache = {}
_ticker_cache_time = {}
_TICKER_TTL = 300


def get_ticker(symbol: str) -> yf.Ticker:
    s = symbol.upper().strip()
    now = datetime.utcnow().timestamp()
    if s not in _ticker_cache or (now - _ticker_cache_time.get(s, 0)) > _TICKER_TTL:
        _ticker_cache[s] = yf.Ticker(s)
        _ticker_cache_time[s] = now
    return _ticker_cache[s]


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
        import urllib.request
        url = f"https://query2.finance.yahoo.com/v1/finance/search?q={q}&quotesCount=8&newsCount=0"
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
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -- API: Quote ---------------------------------------------------------------

@app.route("/api/quote/<symbol>")
def api_quote(symbol):
    try:
        t = get_ticker(symbol)
        info = t.info
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
        return jsonify({"error": str(e)}), 500


# -- API: Price History -------------------------------------------------------

@app.route("/api/history/<symbol>")
def api_history(symbol):
    period = request.args.get("period", "1y")
    interval = request.args.get("interval", "1d")
    try:
        t = get_ticker(symbol)
        df = t.history(period=period, interval=interval)
        if df.empty:
            return jsonify({"error": "No data found"}), 404
        records = []
        for idx, row in df.iterrows():
            ts = int(idx.timestamp() * 1000) if hasattr(idx, "timestamp") else 0
            records.append({
                "date": idx.strftime("%Y-%m-%d"),
                "timestamp": ts,
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]),
            })
        return jsonify(records)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -- API: Fundamentals --------------------------------------------------------

@app.route("/api/fundamentals/<symbol>")
def api_fundamentals(symbol):
    try:
        t = get_ticker(symbol)

        def df_to_dict(df):
            if df is None or df.empty:
                return {}
            result = {}
            for col in df.columns:
                date_str = col.strftime("%Y-%m-%d") if hasattr(col, "strftime") else str(col)
                result[date_str] = {}
                for idx in df.index:
                    val = df.loc[idx, col]
                    if pd.notna(val):
                        result[date_str][str(idx)] = float(val)
                    else:
                        result[date_str][str(idx)] = None
            return result

        financials = df_to_dict(t.financials)
        quarterly_financials = df_to_dict(t.quarterly_financials)
        balance_sheet = df_to_dict(t.balance_sheet)
        quarterly_balance_sheet = df_to_dict(t.quarterly_balance_sheet)
        cashflow = df_to_dict(t.cashflow)
        quarterly_cashflow = df_to_dict(t.quarterly_cashflow)

        return jsonify({
            "financials": financials,
            "quarterlyFinancials": quarterly_financials,
            "balanceSheet": balance_sheet,
            "quarterlyBalanceSheet": quarterly_balance_sheet,
            "cashflow": cashflow,
            "quarterlyCashflow": quarterly_cashflow,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -- API: Market Overview -----------------------------------------------------

@app.route("/api/market")
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
            t = yf.Ticker(sym)
            info = t.info
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
def api_compare():
    symbols = request.args.get("symbols", "").split(",")
    symbols = [s.strip().upper() for s in symbols if s.strip()]
    if not symbols:
        return jsonify({"error": "No symbols provided"}), 400
    period = request.args.get("period", "1y")
    results = {}
    for sym in symbols[:5]:
        try:
            t = get_ticker(sym)
            info = t.info
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
            results[sym] = {
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
            results[sym] = {"error": str(e)}
    return jsonify(results)


# -- API: Portfolio CRUD (with optional auth) ---------------------------------

@app.route("/api/portfolio", methods=["GET"])
@optional_auth
def api_portfolio_list():
    db = get_db()
    user = g.current_user
    if user:
        rows = db.execute("SELECT * FROM holdings WHERE user_id = ? ORDER BY created_at DESC", (user["user_id"],)).fetchall()
    else:
        rows = db.execute("SELECT * FROM holdings WHERE user_id IS NULL ORDER BY created_at DESC").fetchall()
    holdings = [dict(r) for r in rows]

    def enrich_holding(h):
        try:
            t = get_ticker(h["symbol"])
            info = t.info
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
@optional_auth
def api_portfolio_add():
    data = request.get_json()
    if not data or not data.get("symbol") or not data.get("shares") or not data.get("buy_price"):
        return jsonify({"error": "symbol, shares, and buy_price are required"}), 400
    db = get_db()
    user = g.current_user
    user_id = user["user_id"] if user else None
    symbol = data["symbol"].upper().strip()
    name = data.get("name", "")
    if not name:
        try:
            info = get_ticker(symbol).info
            name = safe_get(info, "longName") or safe_get(info, "shortName", symbol)
        except Exception:
            name = symbol
    cursor = db.execute(
        "INSERT INTO holdings (user_id, symbol, name, shares, buy_price, buy_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (user_id, symbol, name, float(data["shares"]), float(data["buy_price"]),
         data.get("buy_date", ""), data.get("notes", ""))
    )
    db.commit()
    return jsonify({"id": cursor.lastrowid, "message": "Holding added"}), 201


@app.route("/api/portfolio/<int:holding_id>", methods=["PUT"])
@optional_auth
def api_portfolio_update(holding_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    db = get_db()
    user = g.current_user
    user_id = user["user_id"] if user else None
    if user_id:
        row = db.execute("SELECT id FROM holdings WHERE id = ? AND user_id = ?", (holding_id, user_id)).fetchone()
    else:
        row = db.execute("SELECT id FROM holdings WHERE id = ? AND user_id IS NULL", (holding_id,)).fetchone()
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
@optional_auth
def api_portfolio_delete(holding_id):
    db = get_db()
    user = g.current_user
    user_id = user["user_id"] if user else None
    if user_id:
        db.execute("DELETE FROM holdings WHERE id = ? AND user_id = ?", (holding_id, user_id))
    else:
        db.execute("DELETE FROM holdings WHERE id = ? AND user_id IS NULL", (holding_id,))
    db.commit()
    return jsonify({"message": "Holding deleted"})


# -- API: Watchlist CRUD (with optional auth) ---------------------------------

@app.route("/api/watchlist", methods=["GET"])
@optional_auth
def api_watchlist_list():
    db = get_db()
    user = g.current_user
    if user:
        rows = db.execute("SELECT * FROM watchlist WHERE user_id = ? ORDER BY added_at DESC", (user["user_id"],)).fetchall()
    else:
        rows = db.execute("SELECT * FROM watchlist WHERE user_id IS NULL ORDER BY added_at DESC").fetchall()
    items = [dict(r) for r in rows]

    def enrich_watchlist_item(item):
        try:
            t = get_ticker(item["symbol"])
            info = t.info
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
@optional_auth
def api_watchlist_add():
    data = request.get_json()
    if not data or not data.get("symbol"):
        return jsonify({"error": "symbol is required"}), 400
    symbol = data["symbol"].upper().strip()
    name = data.get("name", "")
    if not name:
        try:
            info = get_ticker(symbol).info
            name = safe_get(info, "longName") or safe_get(info, "shortName", symbol)
        except Exception:
            name = symbol
    db = get_db()
    user = g.current_user
    user_id = user["user_id"] if user else None
    try:
        db.execute(
            "INSERT OR REPLACE INTO watchlist (user_id, symbol, name) VALUES (?, ?, ?)",
            (user_id, symbol, name)
        )
        db.commit()
    except Exception:
        pass
    return jsonify({"message": f"{symbol} added to watchlist"}), 201


@app.route("/api/watchlist/<symbol>", methods=["DELETE"])
@optional_auth
def api_watchlist_delete(symbol):
    db = get_db()
    user = g.current_user
    if user:
        db.execute("DELETE FROM watchlist WHERE symbol = ? AND user_id = ?", (symbol.upper(), user["user_id"]))
    else:
        db.execute("DELETE FROM watchlist WHERE symbol = ? AND user_id IS NULL", (symbol.upper(),))
    db.commit()
    return jsonify({"message": f"{symbol} removed from watchlist"})


# -- API: Technical Indicators ------------------------------------------------

@app.route("/api/technicals/<symbol>")
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
        gain = delta.where(delta > 0, 0).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
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
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -- News Fetcher (direct Yahoo Finance API) ----------------------------------

def _fetch_yahoo_news(symbol, count=20):
    """Fetch news directly from Yahoo Finance API, bypassing yfinance .news property."""
    import urllib.request
    results = []

    # Method 1: Yahoo search API (news endpoint)
    try:
        url = f"https://query2.finance.yahoo.com/v1/finance/search?q={symbol}&quotesCount=0&newsCount={count}&enableFuzzyQuery=false"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
        for item in data.get("news", []):
            title = item.get("title", "")
            if not title:
                continue
            thumbnail = ""
            if item.get("thumbnail"):
                resolutions = item["thumbnail"].get("resolutions", [])
                if resolutions:
                    thumbnail = resolutions[-1].get("url", "")
            results.append({
                "title": title,
                "publisher": item.get("publisher", ""),
                "link": item.get("link", "") or item.get("url", ""),
                "publishedAt": item.get("providerPublishTime", 0),
                "thumbnail": thumbnail,
            })
    except Exception:
        pass

    # Method 2: yfinance .news fallback (handles both old and new formats)
    if not results:
        try:
            t = get_ticker(symbol)
            news_items = t.news or []
            for item in news_items[:count]:
                title = item.get("title", "")
                if not title:
                    continue
                link = item.get("link", "") or item.get("url", "") or item.get("canonical_url", "")
                pub_date = item.get("providerPublishTime", 0) or item.get("provider_publish_time", 0)
                thumbnail = ""
                if item.get("thumbnail"):
                    resolutions = item["thumbnail"].get("resolutions", [])
                    if resolutions:
                        thumbnail = resolutions[-1].get("url", "")
                elif item.get("img"):
                    thumbnail = item["img"]
                results.append({
                    "title": title,
                    "publisher": item.get("publisher", "") or item.get("source", ""),
                    "link": link,
                    "publishedAt": pub_date,
                    "thumbnail": thumbnail,
                })
        except Exception:
            pass

    return results


def _analyze_sentiment(title):
    """Run VADER sentiment on a headline and return label + scores."""
    scores = sentiment_analyzer.polarity_scores(title)
    compound = scores["compound"]
    if compound >= 0.05:
        label = "positive"
    elif compound <= -0.05:
        label = "negative"
    else:
        label = "neutral"
    return {
        "score": round(compound, 3),
        "label": label,
        "positive": round(scores["pos"], 3),
        "negative": round(scores["neg"], 3),
        "neutral": round(scores["neu"], 3),
    }


# -- API: News with Sentiment Analysis ----------------------------------------

@app.route("/api/news/<symbol>")
def api_news(symbol):
    try:
        news_items = _fetch_yahoo_news(symbol.upper(), count=20)
        results = []
        for item in news_items:
            item["sentiment"] = _analyze_sentiment(item["title"])
            results.append(item)

        avg_sentiment = 0
        if results:
            avg_sentiment = sum(r["sentiment"]["score"] for r in results) / len(results)

        return jsonify({
            "symbol": symbol.upper(),
            "news": results,
            "averageSentiment": round(avg_sentiment, 3),
            "totalArticles": len(results),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -- API: Stock Health Score --------------------------------------------------

@app.route("/api/score/<symbol>")
def api_score(symbol):
    try:
        t = get_ticker(symbol)
        info = t.info

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
        de = safe_get(info, "debtToEquity", 0)
        if de is not None and de >= 0:
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
        return jsonify({"error": str(e)}), 500


# -- API: Market News (General) -----------------------------------------------

@app.route("/api/market-news")
def api_market_news():
    try:
        major_tickers = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META"]
        all_news = []
        seen_titles = set()

        def fetch_sym_news(sym):
            return sym, _fetch_yahoo_news(sym, count=8)

        with ThreadPoolExecutor(max_workers=7) as executor:
            futures = [executor.submit(fetch_sym_news, sym) for sym in major_tickers]
            for f in futures:
                try:
                    sym, items = f.result()
                    for item in items:
                        title = item.get("title", "")
                        if not title or title in seen_titles:
                            continue
                        seen_titles.add(title)
                        item["relatedSymbol"] = sym
                        item["sentiment"] = _analyze_sentiment(title)
                        all_news.append(item)
                except Exception:
                    continue

        all_news.sort(key=lambda x: x.get("publishedAt", 0), reverse=True)
        return jsonify({"news": all_news[:30]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -- Run ----------------------------------------------------------------------

init_db()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8050))
    app.run(debug=True, port=port)
