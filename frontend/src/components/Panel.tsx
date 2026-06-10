import { memo, type ReactNode } from 'react'
import { useLayoutStore, type PanelId } from '../store/layoutStore'

interface PanelProps {
  id: PanelId
  title: string
  /** rendered on the right of the header (timeframe buttons, etc.) */
  actions?: ReactNode
  children: ReactNode
}

// The `.panel-head` class is the React Grid Layout drag handle (see Terminal).
function PanelComponent({ id, title, actions, children }: PanelProps) {
  const togglePanel = useLayoutStore((s) => s.togglePanel)
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">{title}</span>
        <div className="panel-actions">
          {actions}
          <button
            className="panel-x"
            title="Close panel"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => togglePanel(id)}
          >
            ✕
          </button>
        </div>
      </div>
      <div className="panel-body">{children}</div>
    </div>
  )
}

export const Panel = memo(PanelComponent)
