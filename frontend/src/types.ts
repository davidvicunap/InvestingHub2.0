// The unified schema every data source is normalized into before it reaches the
// UI. New providers (crypto, another equity feed) only need a new normalizer
// branch — the charting/grid code never changes. See lib/normalizer.ts.

export interface Quote {
  symbol: string
  name?: string
  price: number
  prevClose: number
  change: number
  changePercent: number
  volume: number
  /** epoch milliseconds of last update */
  ts: number
}

/** A single OHLCV bar. `time` is epoch *seconds* (what lightweight-charts wants). */
export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface SearchResult {
  symbol: string
  name: string
  type: string
  exchange: string
}

export interface OrderBookLevel {
  price: number
  size: number
  side: 'bid' | 'ask'
  total: number
}
