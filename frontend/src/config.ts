// Runtime endpoints. Empty defaults mean "same origin", which in dev is the
// Vite server proxying to Flask (see vite.config.ts).

export const API_BASE: string = (import.meta.env.VITE_API_BASE as string) || ''

export const WS_URL: string =
  (import.meta.env.VITE_WS_URL as string) ||
  `${location.origin.replace(/^http/, 'ws')}/ws`

// Default workspace the terminal boots with on a fresh machine.
export const DEFAULT_SYMBOL = 'AAPL'
export const DEFAULT_WATCHLIST = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'BTC-USD', 'ETH-USD']
