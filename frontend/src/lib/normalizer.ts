// DataNormalizer — the single chokepoint that forces every raw provider payload
// (WebSocket tick, REST quote, REST history) into the app's unified schema.
// Nothing downstream (charts, grids, store) ever sees a raw provider shape.

import type { Candle, Quote, SearchResult } from '../types'

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number)
  return Number.isFinite(n) ? n : fallback
}

export const DataNormalizer = {
  /** WS tick OR the heavier REST /api/quote payload -> Quote. */
  quote(raw: any): Quote {
    const price = num(raw.price ?? raw.regularMarketPrice)
    const prev = num(raw.prevClose ?? raw.previousClose)
    const change = raw.change != null ? num(raw.change) : price && prev ? price - prev : 0
    const changePercent =
      raw.changePercent != null
        ? num(raw.changePercent)
        : prev
          ? ((price - prev) / prev) * 100
          : 0
    return {
      symbol: String(raw.symbol || '').toUpperCase(),
      name: raw.name || undefined,
      price,
      prevClose: prev,
      change: Number(change.toFixed(4)),
      changePercent: Number(changePercent.toFixed(4)),
      volume: num(raw.volume),
      ts: num(raw.ts, Date.now()),
    }
  },

  /** /api/history rows ([{timestamp(ms), open, high, low, close, volume}]) -> Candle[]. */
  candles(raw: any[]): Candle[] {
    if (!Array.isArray(raw)) return []
    return raw
      .map((r) => ({
        // lightweight-charts wants epoch seconds, ascending, de-duplicated.
        time: Math.floor(num(r.timestamp ?? (r.time ? r.time * 1000 : 0)) / 1000),
        open: num(r.open),
        high: num(r.high),
        low: num(r.low),
        close: num(r.close),
        volume: num(r.volume),
      }))
      .filter((c) => c.time > 0)
      .sort((a, b) => a.time - b.time)
  },

  search(raw: any[]): SearchResult[] {
    if (!Array.isArray(raw)) return []
    return raw.map((r) => ({
      symbol: String(r.symbol || '').toUpperCase(),
      name: r.name || '',
      type: r.type || '',
      exchange: r.exchange || '',
    }))
  },
}
