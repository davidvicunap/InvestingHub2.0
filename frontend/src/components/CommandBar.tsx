import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { api } from '../lib/api'
import { useWorkspaceStore, type OverlayId } from '../store/workspaceStore'
import type { SearchResult } from '../types'

type Item =
  | { kind: 'symbol'; symbol: string; label: string; sub: string }
  | { kind: 'overlay'; overlay: OverlayId; label: string; sub: string }

const OVERLAY_COMMANDS: { key: string; overlay: OverlayId; label: string }[] = [
  { key: 'sma20', overlay: 'sma20', label: 'SMA 20' },
  { key: 'sma50', overlay: 'sma50', label: 'SMA 50' },
  { key: 'ema21', overlay: 'ema21', label: 'EMA 21' },
  { key: 'volume', overlay: 'volume', label: 'Volume' },
]

function CommandBarComponent() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const setActiveSymbol = useWorkspaceStore((s) => s.setActiveSymbol)
  const addToWatchlist = useWorkspaceStore((s) => s.addToWatchlist)
  const toggleOverlay = useWorkspaceStore((s) => s.toggleOverlay)
  const overlays = useWorkspaceStore((s) => s.overlays)

  // ⌘K / Ctrl-K toggles; Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  // Debounced symbol search.
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      api
        .search(q, ctrl.signal)
        .then(setResults)
        .catch(() => {})
    }, 160)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query])

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase()
    const overlayItems: Item[] = OVERLAY_COMMANDS.filter((c) => !q || c.key.includes(q) || c.label.toLowerCase().includes(q)).map(
      (c) => ({
        kind: 'overlay',
        overlay: c.overlay,
        label: `${overlays.includes(c.overlay) ? 'Hide' : 'Show'} ${c.label}`,
        sub: 'indicator overlay',
      }),
    )
    const symbolItems: Item[] = results.map((r) => ({
      kind: 'symbol',
      symbol: r.symbol,
      label: r.symbol,
      sub: `${r.name}${r.exchange ? ' · ' + r.exchange : ''}`,
    }))
    // Allow raw-ticker entry even with no search hit (e.g. BTC-USD).
    const raw = query.trim().toUpperCase()
    const rawItem: Item[] =
      raw && !results.some((r) => r.symbol === raw)
        ? [{ kind: 'symbol', symbol: raw, label: raw, sub: 'open ticker' }]
        : []
    return [...overlayItems, ...rawItem, ...symbolItems]
  }, [query, results, overlays])

  const run = useCallback(
    (item: Item) => {
      if (item.kind === 'symbol') {
        setActiveSymbol(item.symbol)
        addToWatchlist(item.symbol)
        api.addWatchlist(item.symbol).catch(() => {})
      } else {
        toggleOverlay(item.overlay)
      }
      setOpen(false)
    },
    [setActiveSymbol, addToWatchlist, toggleOverlay],
  )

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((a) => Math.min(a + 1, items.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((a) => Math.max(a - 1, 0))
      } else if (e.key === 'Enter' && items[active]) {
        run(items[active])
      }
    },
    [items, active, run],
  )

  if (!open) return null
  return (
    <div className="cmd-overlay" onMouseDown={() => setOpen(false)}>
      <div className="cmd-box" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmd-input"
          placeholder="Ticker or indicator (e.g. NVDA, BTC-USD, sma50)…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
        />
        <ul className="cmd-list">
          {items.length === 0 && <li className="cmd-empty">Type a ticker or indicator…</li>}
          {items.map((it, i) => (
            <li
              key={`${it.kind}-${it.kind === 'symbol' ? it.symbol : it.overlay}-${i}`}
              className={`cmd-item ${i === active ? 'active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => run(it)}
            >
              <span className={`cmd-badge ${it.kind}`}>{it.kind === 'symbol' ? 'SYM' : 'IND'}</span>
              <span className="cmd-label">{it.label}</span>
              <span className="cmd-sub">{it.sub}</span>
            </li>
          ))}
        </ul>
        <div className="cmd-hint">↑↓ navigate · ↵ select · esc close</div>
      </div>
    </div>
  )
}

export const CommandBar = memo(CommandBarComponent)
