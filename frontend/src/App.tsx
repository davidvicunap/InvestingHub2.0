import { useEffect } from 'react'
import { TopBar } from './components/TopBar'
import Terminal from './components/Terminal'
import { CommandBar } from './components/CommandBar'
import { startStream, setSubscriptions } from './services/streamClient'
import { useWorkspaceStore } from './store/workspaceStore'

export default function App() {
  const activeSymbol = useWorkspaceStore((s) => s.activeSymbol)
  const watchlist = useWorkspaceStore((s) => s.watchlist)

  // Boot the ingestion worker once.
  useEffect(() => {
    startStream()
  }, [])

  // Keep the live subscription in sync with the active symbol + watchlist.
  useEffect(() => {
    setSubscriptions([activeSymbol, ...watchlist])
  }, [activeSymbol, watchlist])

  return (
    <div className="terminal-root">
      <TopBar />
      <main className="terminal-main">
        <Terminal />
      </main>
      <CommandBar />
    </div>
  )
}
