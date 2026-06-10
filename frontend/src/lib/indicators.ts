// Pure indicator math for chart overlays. Inputs/outputs are in the shape
// lightweight-charts line series expect: { time, value }.

import type { Candle } from '../types'

export interface LinePoint {
  time: number
  value: number
}

export function sma(candles: Candle[], period: number): LinePoint[] {
  const out: LinePoint[] = []
  let sum = 0
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close
    if (i >= period) sum -= candles[i - period].close
    if (i >= period - 1) out.push({ time: candles[i].time, value: sum / period })
  }
  return out
}

export function ema(candles: Candle[], period: number): LinePoint[] {
  if (candles.length < period) return []
  const k = 2 / (period + 1)
  const out: LinePoint[] = []
  // seed with the SMA of the first `period` closes
  let prev = candles.slice(0, period).reduce((a, c) => a + c.close, 0) / period
  out.push({ time: candles[period - 1].time, value: prev })
  for (let i = period; i < candles.length; i++) {
    prev = candles[i].close * k + prev * (1 - k)
    out.push({ time: candles[i].time, value: prev })
  }
  return out
}
