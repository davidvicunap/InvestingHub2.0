// Historical candle data via TanStack Query. Cached in IndexedDB (see
// queryClient), so revisiting a symbol paints from cache instantly while the
// network revalidates.

import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Candle } from '../types'

export type Timeframe = '1D' | '5D' | '1M' | '6M' | '1Y' | '5Y'

const TF: Record<Timeframe, { period: string; interval: string }> = {
  '1D': { period: '1d', interval: '5m' },
  '5D': { period: '5d', interval: '30m' },
  '1M': { period: '1mo', interval: '1d' },
  '6M': { period: '6mo', interval: '1d' },
  '1Y': { period: '1y', interval: '1d' },
  '5Y': { period: '5y', interval: '1wk' },
}

export function useHistory(symbol: string, timeframe: Timeframe) {
  const { period, interval } = TF[timeframe]
  return useQuery<Candle[]>({
    queryKey: ['history', symbol.toUpperCase(), period, interval],
    queryFn: ({ signal }) => api.history(symbol, period, interval, signal),
    enabled: !!symbol,
  })
}
