import { memo } from 'react'
import { Panel } from '../Panel'

// Placeholder pane. There's no news endpoint on the backend yet — wire one in
// app.py (e.g. yfinance `Ticker.news` or an RSS feed) and render it here. Kept
// as a first-class panel so the slot exists in the workspace from day one.
function NewsPanelComponent({ symbol }: { symbol: string }) {
  return (
    <Panel id="news" title={`News · ${symbol}`}>
      <div className="news-empty">
        <p>No news feed connected.</p>
        <p className="muted">
          Add a <code>/api/news/&lt;symbol&gt;</code> route (yfinance <code>Ticker.news</code> or an
          RSS source) and this pane will render it.
        </p>
      </div>
    </Panel>
  )
}

export const NewsPanel = memo(NewsPanelComponent)
