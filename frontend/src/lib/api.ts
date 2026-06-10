// Thin REST client over the Flask backend. Every response is run through the
// DataNormalizer so callers only ever touch the unified schema.

import { API_BASE } from '../config'
import { DataNormalizer } from './normalizer'
import type { Candle, Quote, SearchResult } from '../types'

async function getJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { signal })
  if (!res.ok) throw new Error(`${path} -> ${res.status}`)
  return res.json() as Promise<T>
}

export const api = {
  async history(
    symbol: string,
    period = '1y',
    interval = '1d',
    signal?: AbortSignal,
  ): Promise<Candle[]> {
    const rows = await getJSON<any[]>(
      `/api/history/${encodeURIComponent(symbol)}?period=${period}&interval=${interval}`,
      signal,
    )
    return DataNormalizer.candles(rows)
  },

  async quote(symbol: string, signal?: AbortSignal): Promise<Quote> {
    const raw = await getJSON<any>(`/api/quote/${encodeURIComponent(symbol)}`, signal)
    return DataNormalizer.quote(raw)
  },

  /** Full, un-normalized quote payload (marketCap, P/E, 52w range, …). */
  async rawQuote(symbol: string, signal?: AbortSignal): Promise<Record<string, any>> {
    return getJSON<Record<string, any>>(`/api/quote/${encodeURIComponent(symbol)}`, signal)
  },

  async search(q: string, signal?: AbortSignal): Promise<SearchResult[]> {
    if (!q.trim()) return []
    const raw = await getJSON<any[]>(`/api/search?q=${encodeURIComponent(q)}`, signal)
    return DataNormalizer.search(raw)
  },

  // Watchlist persistence (single-user, no auth).
  async getWatchlist(signal?: AbortSignal): Promise<any[]> {
    return getJSON<any[]>('/api/watchlist', signal)
  },
  async addWatchlist(symbol: string, name?: string): Promise<void> {
    await fetch(`${API_BASE}/api/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, name }),
    })
  },
  async removeWatchlist(symbol: string): Promise<void> {
    await fetch(`${API_BASE}/api/watchlist/${encodeURIComponent(symbol)}`, { method: 'DELETE' })
  },
}
