// Live market data store. Holds a symbol -> Quote map fed by the WebSocket
// ingestion worker. The key render-optimization: applyTicks only swaps the
// object reference for symbols that actually changed, so a component selecting
// `quotes[X]` never re-renders when some *other* ticker ticks.

import { create } from 'zustand'
import type { Quote } from '../types'

interface MarketState {
  quotes: Record<string, Quote>
  connected: boolean
  setConnected: (c: boolean) => void
  applyTicks: (ticks: Quote[]) => void
}

export const useMarketStore = create<MarketState>((set) => ({
  quotes: {},
  connected: false,
  setConnected: (connected) => set({ connected }),
  applyTicks: (ticks) =>
    set((state) => {
      if (!ticks.length) return state
      const quotes = { ...state.quotes }
      for (const t of ticks) quotes[t.symbol] = t
      return { quotes }
    }),
}))

// Stable selector hook for a single symbol — re-renders only on that symbol.
export const useQuote = (symbol: string): Quote | undefined =>
  useMarketStore((s) => s.quotes[symbol.toUpperCase()])

export const useConnected = (): boolean => useMarketStore((s) => s.connected)
