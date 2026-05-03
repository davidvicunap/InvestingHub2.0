import json
import sqlite3
import os
from datetime import datetime, timedelta
from flask import Flask, render_template, jsonify, request, g
import yfinance as yf
import pandas as pd
import numpy as np

app = Flask(__name__)
app.config["DATABASE"] = os.path.join(app.root_path, "portfolio.db")


# ── Database ─────────────────────────────────────────────────────────────────

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
        CREATE TABLE IF NOT EXISTS holdings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
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
            symbol TEXT PRIMARY KEY,
            name TEXT DEFAULT '',
            added_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    db.commit()
    db.close()


# ── Helper: cache yfinance Ticker objects ────────────────────────────────────

_ticker_cache = {}

def get_ticker(symbol: str) -> yf.Ticker:
    s = symbol.upper().strip()
    if s not in _ticker_cache:
        _ticker_cache[s] = yf.Ticker(s)
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


# ── Pages ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


# ── API: Search ──────────────────────────────────────────────────────────────

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


# ── API: Quote ───────────────────────────────────────────────────────────────

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
        }
        price = quote["price"] or 0
        prev = quote["previousClose"] or 0
        quote["change"] = round(price - prev, 2) if price and prev else 0
        quote["changePercent"] = round((price - prev) / prev * 100, 2) if prev else 0
        return jsonify(quote)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── API: Price History ───────────────────────────────────────────────────────

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


# ── API: Fundamentals ────────────────────────────────────────────────────────

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


# ── API: Market Overview ─────────────────────────────────────────────────────

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
    results = []
    for sym, name in indices.items():
        try:
            t = yf.Ticker(sym)
            info = t.info
            price = safe_get(info, "regularMarketPrice") or safe_get(info, "currentPrice", 0)
            prev = safe_get(info, "previousClose") or safe_get(info, "regularMarketPreviousClose", 0)
            change = round(price - prev, 2) if price and prev else 0
            change_pct = round((price - prev) / prev * 100, 2) if prev else 0
            results.append({
                "symbol": sym,
                "name": name,
                "price": price,
                "change": change,
                "changePercent": change_pct,
            })
        except Exception:
            results.append({
                "symbol": sym,
                "name": name,
                "price": 0,
                "change": 0,
                "changePercent": 0,
            })
    return jsonify(results)


# ── API: Compare Stocks ──────────────────────────────────────────────────────

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


# ── API: Portfolio CRUD ──────────────────────────────────────────────────────

@app.route("/api/portfolio", methods=["GET"])
def api_portfolio_list():
    db = get_db()
    rows = db.execute("SELECT * FROM holdings ORDER BY created_at DESC").fetchall()
    holdings = [dict(r) for r in rows]
    for h in holdings:
        try:
            t = get_ticker(h["symbol"])
            info = t.info
            h["currentPrice"] = safe_get(info, "currentPrice") or safe_get(info, "regularMarketPrice", 0)
            h["name"] = safe_get(info, "longName") or safe_get(info, "shortName", h["symbol"])
        except Exception:
            h["currentPrice"] = 0
    return jsonify(holdings)


@app.route("/api/portfolio", methods=["POST"])
def api_portfolio_add():
    data = request.get_json()
    if not data or not data.get("symbol") or not data.get("shares") or not data.get("buy_price"):
        return jsonify({"error": "symbol, shares, and buy_price are required"}), 400
    db = get_db()
    symbol = data["symbol"].upper().strip()
    name = data.get("name", "")
    if not name:
        try:
            info = get_ticker(symbol).info
            name = safe_get(info, "longName") or safe_get(info, "shortName", symbol)
        except Exception:
            name = symbol
    cursor = db.execute(
        "INSERT INTO holdings (symbol, name, shares, buy_price, buy_date, notes) VALUES (?, ?, ?, ?, ?, ?)",
        (symbol, name, float(data["shares"]), float(data["buy_price"]),
         data.get("buy_date", ""), data.get("notes", ""))
    )
    db.commit()
    return jsonify({"id": cursor.lastrowid, "message": "Holding added"}), 201


@app.route("/api/portfolio/<int:holding_id>", methods=["PUT"])
def api_portfolio_update(holding_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    db = get_db()
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
def api_portfolio_delete(holding_id):
    db = get_db()
    db.execute("DELETE FROM holdings WHERE id = ?", (holding_id,))
    db.commit()
    return jsonify({"message": "Holding deleted"})


# ── API: Watchlist CRUD ──────────────────────────────────────────────────────

@app.route("/api/watchlist", methods=["GET"])
def api_watchlist_list():
    db = get_db()
    rows = db.execute("SELECT * FROM watchlist ORDER BY added_at DESC").fetchall()
    items = []
    for r in rows:
        item = dict(r)
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
        items.append(item)
    return jsonify(items)


@app.route("/api/watchlist", methods=["POST"])
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
    try:
        db.execute("INSERT OR REPLACE INTO watchlist (symbol, name) VALUES (?, ?)", (symbol, name))
        db.commit()
    except Exception:
        pass
    return jsonify({"message": f"{symbol} added to watchlist"}), 201


@app.route("/api/watchlist/<symbol>", methods=["DELETE"])
def api_watchlist_delete(symbol):
    db = get_db()
    db.execute("DELETE FROM watchlist WHERE symbol = ?", (symbol.upper(),))
    db.commit()
    return jsonify({"message": f"{symbol} removed from watchlist"})


# ── API: Technical Indicators ────────────────────────────────────────────────

@app.route("/api/technicals/<symbol>")
def api_technicals(symbol):
    period = request.args.get("period", "1y")
    try:
        t = get_ticker(symbol)
        df = t.history(period=period)
        if df.empty:
            return jsonify({"error": "No data"}), 404

        close = df["Close"]

        # SMA
        df["SMA20"] = close.rolling(window=20).mean()
        df["SMA50"] = close.rolling(window=50).mean()
        df["SMA200"] = close.rolling(window=200).mean()

        # EMA
        df["EMA12"] = close.ewm(span=12, adjust=False).mean()
        df["EMA26"] = close.ewm(span=26, adjust=False).mean()

        # MACD
        df["MACD"] = df["EMA12"] - df["EMA26"]
        df["Signal"] = df["MACD"].ewm(span=9, adjust=False).mean()
        df["MACD_Hist"] = df["MACD"] - df["Signal"]

        # RSI
        delta = close.diff()
        gain = delta.where(delta > 0, 0).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        df["RSI"] = 100 - (100 / (1 + rs))

        # Bollinger Bands
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


# ── Run ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=8050)
