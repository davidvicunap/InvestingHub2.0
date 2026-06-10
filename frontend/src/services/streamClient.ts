// Main-thread bridge to the ingestion worker. Spins up the worker, pipes
// normalized ticks into the Zustand market store, and exposes a single
// `setSubscriptions` entry point the UI calls when the watchlist / active
// symbol changes.

import { WS_URL } from '../config'
import { useMarketStore } from '../store/marketStore'
import type { Quote } from '../types'

let worker: Worker | null = null

type WorkerOut =
  | { type: 'ticks'; quotes: Quote[] }
  | { type: 'status'; connected: boolean }

export function startStream(): void {
  if (worker) return
  worker = new Worker(new URL('./streamWorker.ts', import.meta.url), {
    type: 'module',
  })
  worker.onmessage = (ev: MessageEvent<WorkerOut>) => {
    const msg = ev.data
    if (msg.type === 'ticks') {
      useMarketStore.getState().applyTicks(msg.quotes)
    } else if (msg.type === 'status') {
      useMarketStore.getState().setConnected(msg.connected)
    }
  }
  worker.postMessage({ type: 'init', wsUrl: WS_URL })
}

let lastKey = ''
export function setSubscriptions(symbols: string[]): void {
  if (!worker) return
  const unique = Array.from(new Set(symbols.map((s) => s.toUpperCase()))).sort()
  const key = unique.join(',')
  if (key === lastKey) return // nothing changed — skip the round-trip
  lastKey = key
  worker.postMessage({ type: 'subscribe', symbols: unique })
}
