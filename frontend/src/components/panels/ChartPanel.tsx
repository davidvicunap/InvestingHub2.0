import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type UTCTimestamp,
} from 'lightweight-charts'
import { Panel } from '../Panel'
import { useHistory, type Timeframe } from '../../hooks/useHistory'
import { useQuote } from '../../store/marketStore'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { sma, ema } from '../../lib/indicators'
import type { Candle } from '../../types'

const TIMEFRAMES: Timeframe[] = ['1D', '5D', '1M', '6M', '1Y', '5Y']
const UP = '#22c55e'
const DOWN = '#ef4444'

function ChartPanelComponent({ symbol }: { symbol: string }) {
  const [timeframe, setTimeframe] = useState<Timeframe>('6M')
  const { data: candles, isLoading, isError } = useHistory(symbol, timeframe)
  const overlays = useWorkspaceStore((s) => s.overlays)
  const liveQuote = useQuote(symbol)

  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const overlayRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map())
  const lastBarRef = useRef<CandlestickData | null>(null)

  // --- create the chart once -------------------------------------------------
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9aa4b2',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true },
      autoSize: false,
    })
    const candle = chart.addCandlestickSeries({
      upColor: UP,
      downColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      borderVisible: false,
    })
    const volume = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      color: 'rgba(120,130,150,0.4)',
    })
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })

    chartRef.current = chart
    candleRef.current = candle
    volumeRef.current = volume

    const ro = new ResizeObserver(() => {
      chart.resize(el.clientWidth, el.clientHeight)
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      candleRef.current = null
      volumeRef.current = null
      overlayRef.current.clear()
    }
  }, [])

  // --- compute overlay line data (memoized) ----------------------------------
  const overlayData = useMemo(() => {
    if (!candles) return {} as Record<string, LineData[]>
    const map: Record<string, LineData[]> = {}
    const toLine = (pts: { time: number; value: number }[]) =>
      pts.map((p) => ({ time: p.time as UTCTimestamp, value: p.value }))
    if (overlays.includes('sma20')) map.sma20 = toLine(sma(candles, 20))
    if (overlays.includes('sma50')) map.sma50 = toLine(sma(candles, 50))
    if (overlays.includes('ema21')) map.ema21 = toLine(ema(candles, 21))
    return map
  }, [candles, overlays])

  // --- push history into the series ------------------------------------------
  useEffect(() => {
    const candle = candleRef.current
    const volume = volumeRef.current
    const chart = chartRef.current
    if (!candle || !volume || !chart || !candles) return

    const candleData: CandlestickData[] = candles.map((c: Candle) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))
    const volData: HistogramData[] = candles.map((c: Candle) => ({
      time: c.time as UTCTimestamp,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)',
    }))
    candle.setData(candleData)
    volume.setData(overlays.includes('volume') ? volData : [])
    lastBarRef.current = candleData[candleData.length - 1] ?? null

    // reconcile overlay line series with the current overlay set
    const colors: Record<string, string> = {
      sma20: '#38bdf8',
      sma50: '#f59e0b',
      ema21: '#a78bfa',
    }
    const live = overlayRef.current
    for (const [id, series] of live) {
      if (!overlayData[id]) {
        chart.removeSeries(series)
        live.delete(id)
      }
    }
    for (const id of Object.keys(overlayData)) {
      let series = live.get(id)
      if (!series) {
        series = chart.addLineSeries({
          color: colors[id] || '#888',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        })
        live.set(id, series)
      }
      series.setData(overlayData[id])
    }
    chart.timeScale().fitContent()
  }, [candles, overlayData, overlays])

  // --- live tick: fold the latest price into the last bar --------------------
  useEffect(() => {
    const candle = candleRef.current
    const last = lastBarRef.current
    if (!candle || !last || !liveQuote || !liveQuote.price) return
    const updated: CandlestickData = {
      time: last.time,
      open: last.open,
      high: Math.max(last.high, liveQuote.price),
      low: Math.min(last.low, liveQuote.price),
      close: liveQuote.price,
    }
    lastBarRef.current = updated
    candle.update(updated)
  }, [liveQuote])

  const onPickTf = useCallback((tf: Timeframe) => setTimeframe(tf), [])

  const actions = (
    <div className="tf-row" onMouseDown={(e) => e.stopPropagation()}>
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          className={`tf-btn ${tf === timeframe ? 'active' : ''}`}
          onClick={() => onPickTf(tf)}
        >
          {tf}
        </button>
      ))}
    </div>
  )

  return (
    <Panel id="chart" title={`${symbol} · Chart`} actions={actions}>
      <div className="chart-wrap">
        {isError && <div className="panel-msg">No data for {symbol}</div>}
        {isLoading && <div className="panel-msg">Loading {symbol}…</div>}
        <div ref={containerRef} className="chart-host" />
      </div>
    </Panel>
  )
}

export const ChartPanel = memo(ChartPanelComponent)
