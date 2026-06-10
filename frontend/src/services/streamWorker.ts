/// <reference lib="webworker" />
// Background ingestion worker. All WebSocket I/O, JSON parsing and tick
// normalization happen here, off the main thread, so a burst of market data
// can never block rendering or interaction. The worker posts already-normalized
// Quote batches back to the main thread.

import { DataNormalizer } from '../lib/normalizer'
import type { Quote } from '../types'

type InMsg =
  | { type: 'init'; wsUrl: string }
  | { type: 'subscribe'; symbols: string[] }

type OutMsg =
  | { type: 'ticks'; quotes: Quote[] }
  | { type: 'status'; connected: boolean }

const post = (m: OutMsg) => (self as DedicatedWorkerGlobalScope).postMessage(m)

let ws: WebSocket | null = null
let wsUrl = ''
let desired: string[] = []
let backoff = 1000
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

function sendSubscription() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'set', symbols: desired }))
  }
}

function connect() {
  if (!wsUrl) return
  try {
    ws = new WebSocket(wsUrl)
  } catch {
    scheduleReconnect()
    return
  }

  ws.onopen = () => {
    backoff = 1000
    post({ type: 'status', connected: true })
    sendSubscription()
  }

  ws.onmessage = (ev) => {
    let msg: any
    try {
      msg = JSON.parse(ev.data as string)
    } catch {
      return
    }
    if (msg.type === 'tick' && Array.isArray(msg.quotes)) {
      const quotes = msg.quotes.map((q: any) => DataNormalizer.quote(q))
      post({ type: 'ticks', quotes })
    }
  }

  ws.onclose = () => {
    post({ type: 'status', connected: false })
    scheduleReconnect()
  }

  ws.onerror = () => {
    try {
      ws?.close()
    } catch {
      /* noop */
    }
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    backoff = Math.min(backoff * 2, 15000) // capped exponential backoff
    connect()
  }, backoff)
}

self.onmessage = (ev: MessageEvent<InMsg>) => {
  const msg = ev.data
  if (msg.type === 'init') {
    wsUrl = msg.wsUrl
    connect()
  } else if (msg.type === 'subscribe') {
    desired = msg.symbols
    sendSubscription()
  }
}
