# InvestorHub Terminal

A single-user, high-performance financial terminal. No sign-in, no user accounts —
a local analytical tool with a Bloomberg-style modular grid.

## Architecture

```
Flask backend (app.py)                     React/TS terminal (frontend/)
─────────────────────                      ──────────────────────────────
REST  /api/quote, /history, ...     ◀────  TanStack Query  → IndexedDB cache
WebSocket  /ws  (stream.py)         ◀────  Web Worker (WS ingestion)
  └ polls yfinance, fans ticks out          └ DataNormalizer → unified schema
                                                   │
                                            Zustand store (selector-scoped)
                                                   │
                                            React Grid Layout (drag/resize,
                                            localStorage-persisted)
                                              ├ Lightweight Charts (candles + vol + overlays)
                                              ├ AG-Grid (watchlist, order book)
                                              ├ Key Stats / News
                                              └ Command Bar (⌘K)
```

### Key engineering choices
- **No auth.** Portfolio/watchlist are single-user (`SINGLE_USER_ID = 1` in `app.py`);
  the DB schema is unchanged, so existing data is preserved.
- **WebSocket-first, simulated source.** yfinance has no push feed, so `stream.py`
  polls on one shared background thread and fans normalized ticks to subscribers.
  Swap in a real feed later without touching the frontend.
- **Background ingestion.** All WS I/O + JSON parse + normalization run in a Web
  Worker (`src/services/streamWorker.ts`), never on the main thread.
- **Minimal re-renders.** The market store keeps a `symbol → Quote` map and only
  swaps the reference for symbols that changed; AG-Grid updates via
  `applyTransactionAsync` (no React re-render per tick); chart/panels are `React.memo`.
- **Unified schema.** Every provider payload passes through `DataNormalizer`
  (`src/lib/normalizer.ts`) before reaching any UI code.
- **Persistence.** Grid layout + workspace → `localStorage`; historical data →
  IndexedDB (via TanStack Query), so reopening paints instantly.

## Local development

Two processes:

```bash
# 1. Backend (Flask on :8050)
pip install -r requirements.txt        # or use the existing venv
python app.py

# 2. Frontend (Vite on :5173, proxies /api and /ws to :8050)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Press **⌘K** (or Ctrl-K) for the command bar:
type a ticker (`NVDA`, `BTC-USD`) to switch, or an indicator (`sma50`, `volume`)
to toggle an overlay.

## Production build / deploy

The Vite build outputs to `docs/` for GitHub Pages:

```bash
cd frontend
VITE_BASE=/InvestingHub2.0/ \
VITE_API_BASE=https://<your-render-app>.onrender.com \
VITE_WS_URL=wss://<your-render-app>.onrender.com/ws \
npm run build
```

CI (`.github/workflows/jekyll-gh-pages.yml`) does this automatically on push to
`main`, reading `API_BASE` and `WS_URL` from repo **Actions variables**. Set those
or the deployed site won't reach the backend.

The Flask API deploys on Render (`Procfile`); the threaded gunicorn worker handles
both REST and the WebSocket upgrade.

## Legacy

The previous Alpine.js + ApexCharts app is preserved under `legacy/` for reference.
