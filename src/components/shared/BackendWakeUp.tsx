import { Server } from 'lucide-react'
import type { ReactElement } from 'react'
import { useBackendStatus } from '../../contexts/BackendStatusContext'
import LoadingSpinner from './LoadingSpinner'

export default function BackendWakeUp(): ReactElement {
  const { elapsedSeconds } = useBackendStatus()
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 text-center shadow-card">
        <span className="grid size-14 place-items-center rounded-lg bg-accent-subtle">
          <Server size={32} aria-hidden="true" className="text-accent" />
        </span>
        <h1 className="text-2xl">Waking up the game server</h1>
        <p className="text-ink-muted">The server sleeps when nobody is playing. Waking it takes up to a minute.</p>
        <div className="tabular-nums">
          <LoadingSpinner label={`${elapsedSeconds} s`} />
        </div>
      </div>
    </main>
  )
}
