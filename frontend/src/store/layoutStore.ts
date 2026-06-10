// Grid layout persistence. React Grid Layout positions are saved to
// localStorage so a custom workspace (where you dragged each pane) reloads
// instantly. Panel visibility lives here too.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Layout } from 'react-grid-layout'

export type PanelId = 'chart' | 'watchlist' | 'orderbook' | 'news' | 'stats'

export interface PanelDef {
  id: PanelId
  title: string
}

export const PANELS: Record<PanelId, PanelDef> = {
  chart: { id: 'chart', title: 'Chart' },
  watchlist: { id: 'watchlist', title: 'Watchlist' },
  orderbook: { id: 'orderbook', title: 'Order Book' },
  stats: { id: 'stats', title: 'Key Stats' },
  news: { id: 'news', title: 'News' },
}

// Default Bloomberg-ish arrangement on a 12-col grid.
const DEFAULT_LAYOUT: Layout[] = [
  { i: 'chart', x: 0, y: 0, w: 8, h: 14, minW: 4, minH: 6 },
  { i: 'watchlist', x: 8, y: 0, w: 4, h: 8, minW: 2, minH: 4 },
  { i: 'orderbook', x: 8, y: 8, w: 4, h: 6, minW: 2, minH: 4 },
  { i: 'stats', x: 0, y: 14, w: 8, h: 6, minW: 3, minH: 4 },
  { i: 'news', x: 8, y: 14, w: 4, h: 6, minW: 2, minH: 4 },
]

interface LayoutState {
  layout: Layout[]
  hidden: PanelId[]
  setLayout: (l: Layout[]) => void
  togglePanel: (id: PanelId) => void
  resetLayout: () => void
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      layout: DEFAULT_LAYOUT,
      hidden: [],
      setLayout: (layout) => set({ layout }),
      togglePanel: (id) =>
        set((st) => ({
          hidden: st.hidden.includes(id)
            ? st.hidden.filter((x) => x !== id)
            : [...st.hidden, id],
        })),
      resetLayout: () => set({ layout: DEFAULT_LAYOUT, hidden: [] }),
    }),
    { name: 'ih-terminal-layout' },
  ),
)
