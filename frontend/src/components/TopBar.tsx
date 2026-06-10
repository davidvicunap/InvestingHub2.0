import { memo } from 'react'
import { useConnected, useQuote } from '../store/marketStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import { useLayoutStore, PANELS, type PanelId } from '../store/layoutStore'

function LiveBadge({ symbol }: { symbol: string }) {
  const q = useQuote(symbol)
  const up = (q?.change ?? 0) >= 0
  return (
    <div className="lb">
      <span className="lb-sym">{symbol}</span>
      <span className="lb-price">{q ? q.price.toFixed(2) : '—'}</span>
      <span className={`lb-chg ${up ? 'cell-up' : 'cell-down'}`}>
        {q ? `${up ? '+' : ''}${q.change.toFixed(2)} (${up ? '+' : ''}${q.changePercent.toFixed(2)}%)` : ''}
      </span>
    </div>
  )
}

function TopBarComponent() {
  const connected = useConnected()
  const activeSymbol = useWorkspaceStore((s) => s.activeSymbol)
  const hidden = useLayoutStore((s) => s.hidden)
  const togglePanel = useLayoutStore((s) => s.togglePanel)
  const resetLayout = useLayoutStore((s) => s.resetLayout)

  const panelIds = Object.keys(PANELS) as PanelId[]

  return (
    <header className="topbar">
      <div className="tb-left">
        <span className="brand">INVESTOR<span className="brand-accent">HUB</span></span>
        <span className="brand-tag">TERMINAL</span>
        <LiveBadge symbol={activeSymbol} />
      </div>
      <div className="tb-right">
        <button className="cmd-trigger" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}>
          <span>⌘K</span> Command
        </button>
        <div className="panel-toggles">
          {panelIds.map((id) => (
            <button
              key={id}
              className={`pt ${hidden.includes(id) ? '' : 'on'}`}
              onClick={() => togglePanel(id)}
              title={`Toggle ${PANELS[id].title}`}
            >
              {PANELS[id].title}
            </button>
          ))}
          <button className="pt reset" onClick={resetLayout} title="Reset layout">
            ⟲
          </button>
        </div>
        <span className={`conn ${connected ? 'up' : 'down'}`}>{connected ? 'LIVE' : 'OFFLINE'}</span>
      </div>
    </header>
  )
}

export const TopBar = memo(TopBarComponent)
