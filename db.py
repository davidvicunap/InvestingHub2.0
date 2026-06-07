"""Database layer with a provider-agnostic adapter.

Local dev uses SQLite (zero setup). Production uses Postgres when a
``DATABASE_URL`` env var is present (Render/Neon/Supabase style). The rest of
the app talks to a single small interface — ``connect()`` returns an object
exposing ``.execute(sql, params)`` (which returns a result with
``.fetchone()``, ``.fetchall()`` and ``.lastrowid``), plus ``.commit()`` and
``.close()`` — so the route handlers are identical across both backends.

SQL is written once in SQLite dialect (``?`` placeholders, ``INSERT OR
IGNORE``) and translated for Postgres at execution time.
"""

import os
import re
import sqlite3

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
USE_POSTGRES = DATABASE_URL.startswith(("postgres://", "postgresql://"))

DATABASE_PATH = os.environ.get(
    "DATABASE_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "portfolio.db"),
)

if USE_POSTGRES:
    import psycopg
    from psycopg.rows import dict_row
    from psycopg_pool import ConnectionPool

    # psycopg3 wants the "postgresql://" scheme; Render/Heroku hand out "postgres://".
    _dsn = re.sub(r"^postgres://", "postgresql://", DATABASE_URL)
    # A small pool sized for Render's free tier. min_size keeps a warm connection
    # so the first request after idle doesn't pay TCP+TLS setup latency.
    _pool = ConnectionPool(
        _dsn,
        min_size=1,
        max_size=int(os.environ.get("DB_POOL_MAX", "8")),
        kwargs={"row_factory": dict_row, "autocommit": False},
        open=True,
    )
    IntegrityError = psycopg.errors.IntegrityError
else:
    _pool = None
    IntegrityError = sqlite3.IntegrityError

# Exceptions raised on a UNIQUE/constraint violation, regardless of backend.
INTEGRITY_ERRORS = (IntegrityError,)


# -- Postgres adapter (only used when USE_POSTGRES) ---------------------------

class _Result:
    """Eagerly-fetched result mimicking the sqlite3 cursor surface we use."""

    __slots__ = ("_rows", "lastrowid")

    def __init__(self, rows, lastrowid):
        self._rows = rows
        self.lastrowid = lastrowid

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return self._rows


_INSERT_IGNORE_RE = re.compile(r"INSERT\s+OR\s+IGNORE\s+INTO", re.IGNORECASE)
_INSERT_RE = re.compile(r"^\s*INSERT\b", re.IGNORECASE)


def _translate(sql: str) -> str:
    # psycopg's param parser treats '%' specially, so any literal '%' in the SQL
    # (e.g. a LIKE pattern) must be doubled. Escape first, then map sqlite's '?'
    # placeholders to psycopg's '%s'. Source SQL never contains '%s', so this is
    # unambiguous. (Connections always execute with a params tuple, so psycopg
    # always runs this parsing pass and collapses '%%' back to '%'.)
    return sql.replace("%", "%%").replace("?", "%s")


class PgConn:
    """Wraps a pooled psycopg connection in the sqlite-style interface."""

    __slots__ = ("_conn", "_pool")

    def __init__(self, conn, pool):
        self._conn = conn
        self._pool = pool

    def execute(self, sql, params=()):
        insert_ignore = bool(_INSERT_IGNORE_RE.search(sql))
        tsql = _translate(_INSERT_IGNORE_RE.sub("INSERT INTO", sql))
        if insert_ignore:
            tsql += " ON CONFLICT DO NOTHING"
        # Emulate sqlite's cursor.lastrowid via RETURNING id on plain inserts.
        add_returning = bool(_INSERT_RE.match(tsql)) and "RETURNING" not in tsql.upper()
        if add_returning:
            tsql += " RETURNING id"

        with self._conn.cursor() as cur:
            cur.execute(tsql, tuple(params))
            rows, lastrowid = [], None
            if cur.description is not None:
                fetched = cur.fetchall()
                if add_returning:
                    lastrowid = fetched[0]["id"] if fetched else None
                else:
                    rows = fetched
        return _Result(rows, lastrowid)

    def commit(self):
        self._conn.commit()

    def close(self):
        # Discard any uncommitted state before returning the connection to the
        # pool so the next checkout starts clean.
        try:
            self._conn.rollback()
        except Exception:
            pass
        self._pool.putconn(self._conn)


# -- Public API ---------------------------------------------------------------

def connect():
    """Return a per-request connection (sqlite3.Connection or PgConn)."""
    if USE_POSTGRES:
        return PgConn(_pool.getconn(), _pool)
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


_SQLITE_SCHEMA = [
    """CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )""",
    """CREATE TABLE IF NOT EXISTS holdings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        symbol TEXT NOT NULL,
        name TEXT DEFAULT '',
        shares REAL NOT NULL,
        buy_price REAL NOT NULL,
        buy_date TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )""",
    """CREATE TABLE IF NOT EXISTS watchlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        symbol TEXT NOT NULL,
        name TEXT DEFAULT '',
        added_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, symbol)
    )""",
    "CREATE INDEX IF NOT EXISTS idx_holdings_user ON holdings(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id)",
]

_POSTGRES_SCHEMA = [
    """CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )""",
    """CREATE TABLE IF NOT EXISTS holdings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        symbol TEXT NOT NULL,
        name TEXT DEFAULT '',
        shares DOUBLE PRECISION NOT NULL,
        buy_price DOUBLE PRECISION NOT NULL,
        buy_date TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )""",
    """CREATE TABLE IF NOT EXISTS watchlist (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        symbol TEXT NOT NULL,
        name TEXT DEFAULT '',
        added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, symbol)
    )""",
    "CREATE INDEX IF NOT EXISTS idx_holdings_user ON holdings(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id)",
]


def init_db():
    """Create tables and indexes if they don't exist (idempotent)."""
    statements = _POSTGRES_SCHEMA if USE_POSTGRES else _SQLITE_SCHEMA
    if USE_POSTGRES:
        with _pool.connection() as conn:
            for stmt in statements:
                conn.execute(stmt)
            conn.commit()
    else:
        conn = sqlite3.connect(DATABASE_PATH)
        for stmt in statements:
            conn.execute(stmt)
        conn.commit()
        conn.close()
