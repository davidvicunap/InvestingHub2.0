import { memo, useCallback } from 'react'
import GridLayout, { WidthProvider, type Layout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { useLayoutStore, type PanelId } from '../store/layoutStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import { ChartPanel } from './panels/ChartPanel'
import { WatchlistPanel } from './panels/WatchlistPanel'
import { OrderBookPanel } from './panels/OrderBookPanel'
import { StatsPanel } from './panels/StatsPanel'
import { NewsPanel } from './panels/NewsPanel'

const Grid = WidthProvider(GridLayout)

function Terminal() {
  const layout = useLayoutStore((s) => s.layout)
  const hidden = useLayoutStore((s) => s.hidden)
  const setLayout = useLayoutStore((s) => s.setLayout)
  const activeSymbol = useWorkspaceStore((s) => s.activeSymbol)

  const visible = layout.filter((l) => !hidden.includes(l.i as PanelId))

  // Persist drag/resize, but keep hidden panels' saved geometry intact.
  const onLayoutChange = useCallback(
    (next: Layout[]) => {
      const hiddenEntries = useLayoutStore
        .getState()
        .layout.filter((l) => useLayoutStore.getState().hidden.includes(l.i as PanelId))
      setLayout([...next, ...hiddenEntries])
    },
    [setLayout],
  )

  const renderPanel = (id: PanelId) => {
    switch (id) {
      case 'chart':
        return <ChartPanel symbol={activeSymbol} />
      case 'watchlist':
        return <WatchlistPanel />
      case 'orderbook':
        return <OrderBookPanel />
      case 'stats':
        return <StatsPanel symbol={activeSymbol} />
      case 'news':
        return <NewsPanel symbol={activeSymbol} />
      default:
        return null
    }
  }

  return (
    <Grid
      className="terminal-grid"
      layout={visible}
      cols={12}
      rowHeight={24}
      margin={[6, 6]}
      containerPadding={[8, 8]}
      draggableHandle=".panel-head"
      onLayoutChange={onLayoutChange}
      compactType="vertical"
      resizeHandles={['se']}
    >
      {visible.map((l) => (
        <div key={l.i} className="grid-cell">
          {renderPanel(l.i as PanelId)}
        </div>
      ))}
    </Grid>
  )
}

export default memo(Terminal)
