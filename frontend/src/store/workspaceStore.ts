// Workspace state: which ticker is in focus and what's on the watchlist.
// Persisted to localStorage so the terminal reopens exactly where you left it.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_SYMBOL, DEFAULT_WATCHLIST } from '../config'

export type OverlayId = 'sma20' | 'sma50' | 'ema21' | 'volume'

interface WorkspaceState {
  activeSymbol: string
  watchlist: string[]
  overlays: OverlayId[]
  setActiveSymbol: (s: string) => void
  addToWatchlist: (s: string) => void
  removeFromWatchlist: (s: string) => void
  toggleOverlay: (o: OverlayId) => void
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      activeSymbol: DEFAULT_SYMBOL,
      watchlist: DEFAULT_WATCHLIST,
      overlays: ['volume', 'sma20'],
      setActiveSymbol: (s) => set({ activeSymbol: s.toUpperCase() }),
      addToWatchlist: (s) =>
        set((st) => {
          const sym = s.toUpperCase()
          return st.watchlist.includes(sym)
            ? st
            : { watchlist: [sym, ...st.watchlist] }
        }),
      removeFromWatchlist: (s) =>
        set((st) => ({ watchlist: st.watchlist.filter((x) => x !== s.toUpperCase()) })),
      toggleOverlay: (o) =>
        set((st) => ({
          overlays: st.overlays.includes(o)
            ? st.overlays.filter((x) => x !== o)
            : [...st.overlays, o],
        })),
    }),
    { name: 'ih-terminal-workspace' },
  ),
)
