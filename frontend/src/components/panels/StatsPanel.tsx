import { memo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Panel } from '../Panel'
import { api } from '../../lib/api'
import { useQuote } from '../../store/marketStore'

const big = (n: number) =>
  !n ? '—' : n >= 1e12 ? `${(n / 1e12).toFixed(2)}T` : n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : `${n}`
const n2 = (n: number) => (n == null || !Number.isFinite(n) ? '—' : n.toFixed(2))
const pct = (n: number) => (n == null || !Number.isFinite(n) ? '—' : `${(n * 100).toFixed(2)}%`)

function StatsPanelComponent({ symbol }: { symbol: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['quote', symbol.toUpperCase()],
    queryFn: ({ signal }) => api.rawQuote(symbol, signal),
    enabled: !!symbol,
  })
  // Live price preferred over the (cached) REST snapshot.
  const live = useQuote(symbol)
  const price = live?.price || data?.price || 0

  const rows: [string, string][] = data
    ? [
        ['Last', n2(price)],
        ['Prev Close', n2(data.previousClose)],
        ['Open', n2(data.open)],
        ['Day Range', `${n2(data.dayLow)} – ${n2(data.dayHigh)}`],
        ['52W Range', `${n2(data.fiftyTwoWeekLow)} – ${n2(data.fiftyTwoWeekHigh)}`],
        ['Volume', big(data.volume)],
        ['Avg Vol', big(data.avgVolume)],
        ['Mkt Cap', big(data.marketCap)],
        ['P/E', n2(data.peRatio)],
        ['Fwd P/E', n2(data.forwardPE)],
        ['EPS', n2(data.eps)],
        ['Beta', n2(data.beta)],
        ['Div Yield', pct(data.dividendYield)],
        ['ROE', pct(data.returnOnEquity)],
        ['Profit Mgn', pct(data.profitMargin)],
        ['Sector', data.sector || '—'],
      ]
    : []

  return (
    <Panel id="stats" title={`Key Stats · ${symbol}`}>
      {isLoading && !data ? (
        <div className="panel-msg">Loading…</div>
      ) : (
        <div className="stats-grid">
          {rows.map(([k, v]) => (
            <div className="stat" key={k}>
              <span className="stat-k">{k}</span>
              <span className="stat-v">{v}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

export const StatsPanel = memo(StatsPanelComponent)
