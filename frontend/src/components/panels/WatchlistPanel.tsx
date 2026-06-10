import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridReadyEvent, GridApi, CellClassParams } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'
import { Panel } from '../Panel'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { useMarketStore } from '../../store/marketStore'
import { api } from '../../lib/api'

interface Row {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
}

const fmt = (n: number, d = 2) =>
  n == null || !Number.isFinite(n) ? '—' : n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtVol = (n: number) =>
  !n ? '—' : n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${n}`

function WatchlistPanelComponent() {
  const watchlist = useWorkspaceStore((s) => s.watchlist)
  const setActiveSymbol = useWorkspaceStore((s) => s.setActiveSymbol)
  const removeFromWatchlist = useWorkspaceStore((s) => s.removeFromWatchlist)
  const gridApiRef = useRef<GridApi<Row> | null>(null)

  const colorClass = (p: CellClassParams<Row>) =>
    (p.data?.change ?? 0) >= 0 ? 'cell-up' : 'cell-down'

  const columnDefs = useMemo<ColDef<Row>[]>(
    () => [
      { field: 'symbol', headerName: 'Sym', width: 90, cellClass: 'cell-sym', pinned: 'left' },
      { field: 'price', headerName: 'Last', flex: 1, type: 'rightAligned', valueFormatter: (p) => fmt(p.value) },
      { field: 'change', headerName: 'Chg', flex: 1, type: 'rightAligned', valueFormatter: (p) => fmt(p.value), cellClass: colorClass },
      {
        field: 'changePercent',
        headerName: '%',
        flex: 1,
        type: 'rightAligned',
        valueFormatter: (p) => (p.value == null ? '—' : `${p.value >= 0 ? '+' : ''}${fmt(p.value)}%`),
        cellClass: colorClass,
      },
      { field: 'volume', headerName: 'Vol', flex: 1, type: 'rightAligned', valueFormatter: (p) => fmtVol(p.value) },
      {
        headerName: '',
        width: 36,
        cellRenderer: () => '✕',
        cellClass: 'cell-del',
        sortable: false,
      },
    ],
    [],
  )

  const defaultColDef = useMemo<ColDef>(() => ({ sortable: true, resizable: true, suppressMovable: false }), [])

  // Seed rows from the watchlist; live prices arrive via store transactions.
  const rowData = useMemo<Row[]>(
    () => watchlist.map((symbol) => ({ symbol, price: 0, change: 0, changePercent: 0, volume: 0 })),
    [watchlist],
  )

  const onGridReady = useCallback((e: GridReadyEvent<Row>) => {
    gridApiRef.current = e.api
  }, [])

  // Push live ticks straight into AG-Grid cells without re-rendering React.
  useEffect(() => {
    const unsub = useMarketStore.subscribe((state) => {
      const api2 = gridApiRef.current
      if (!api2) return
      const updates: Row[] = []
      for (const sym of watchlist) {
        const q = state.quotes[sym]
        if (q) updates.push({ symbol: sym, price: q.price, change: q.change, changePercent: q.changePercent, volume: q.volume })
      }
      if (updates.length) api2.applyTransactionAsync({ update: updates })
    })
    return unsub
  }, [watchlist])

  const onCellClicked = useCallback(
    (e: { colDef: ColDef; data?: Row }) => {
      if (!e.data) return
      if (e.colDef.cellClass === 'cell-del') {
        removeFromWatchlist(e.data.symbol)
        api.removeWatchlist(e.data.symbol).catch(() => {})
      } else {
        setActiveSymbol(e.data.symbol)
      }
    },
    [setActiveSymbol, removeFromWatchlist],
  )

  return (
    <Panel id="watchlist" title="Watchlist">
      <div className="ag-theme-quartz-dark grid-host">
        <AgGridReact<Row>
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={(p) => p.data.symbol}
          onGridReady={onGridReady}
          onCellClicked={onCellClicked}
          rowHeight={26}
          headerHeight={28}
          animateRows={false}
          suppressCellFocus
        />
      </div>
    </Panel>
  )
}

export const WatchlistPanel = memo(WatchlistPanelComponent)
