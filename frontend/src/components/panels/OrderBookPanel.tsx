import { memo, useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import { Panel } from '../Panel'
import { useQuote } from '../../store/marketStore'
import { useWorkspaceStore } from '../../store/workspaceStore'
import type { OrderBookLevel } from '../../types'

// NOTE: Yahoo/yfinance exposes no Level-2 depth, so this is a *synthetic* book
// derived from the live last price — a realistic ladder for layout/UX, clearly
// labelled so it's never mistaken for a real exchange feed. Swap in a real
// depth provider here later; the unified schema (OrderBookLevel) stays.
const LEVELS = 9

function buildBook(price: number): OrderBookLevel[] {
  if (!price) return []
  const tick = Math.max(price * 0.0005, 0.01)
  const out: OrderBookLevel[] = []
  let askTotal = 0
  for (let i = LEVELS; i >= 1; i--) {
    const size = Math.round(200 + ((i * 9301 + 49297) % 800))
    askTotal += size
    out.push({ side: 'ask', price: +(price + tick * i).toFixed(2), size, total: askTotal })
  }
  let bidTotal = 0
  for (let i = 1; i <= LEVELS; i++) {
    const size = Math.round(200 + ((i * 6151 + 12345) % 800))
    bidTotal += size
    out.push({ side: 'bid', price: +(price - tick * i).toFixed(2), size, total: bidTotal })
  }
  return out
}

function OrderBookPanelComponent() {
  const symbol = useWorkspaceStore((s) => s.activeSymbol)
  const quote = useQuote(symbol)
  const price = quote?.price ?? 0

  const rowData = useMemo(() => buildBook(price), [price])

  const columnDefs = useMemo<ColDef<OrderBookLevel>[]>(
    () => [
      {
        field: 'price',
        headerName: 'Price',
        flex: 1,
        valueFormatter: (p) => (p.value ? p.value.toFixed(2) : '—'),
        cellClass: (p) => (p.data?.side === 'ask' ? 'cell-down' : 'cell-up'),
      },
      { field: 'size', headerName: 'Size', flex: 1, type: 'rightAligned' },
      { field: 'total', headerName: 'Total', flex: 1, type: 'rightAligned' },
    ],
    [],
  )

  return (
    <Panel id="orderbook" title={`Order Book · ${symbol}`}>
      <div className="ag-theme-quartz-dark grid-host">
        <AgGridReact<OrderBookLevel>
          rowData={rowData}
          columnDefs={columnDefs}
          getRowId={(p) => `${p.data.side}-${p.data.price}`}
          rowHeight={22}
          headerHeight={26}
          animateRows={false}
          suppressCellFocus
        />
      </div>
      <div className="panel-foot">synthetic depth · last {price ? price.toFixed(2) : '—'}</div>
    </Panel>
  )
}

export const OrderBookPanel = memo(OrderBookPanelComponent)
