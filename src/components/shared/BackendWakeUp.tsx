import { RotateCw, Server, ServerOff, WifiOff, type LucideIcon } from 'lucide-react'
import { useState, type ReactElement } from 'react'
import { useBackendStatus, type BackendState } from '../../contexts/BackendStatusContext'
import { TONE_CHIP, TONE_MARK, type StatusTone } from '../../styles/tones'
import Button from './Button'
import LoadingSpinner from './LoadingSpinner'

interface Problem {
  tone: StatusTone
  icon: LucideIcon
  title: string
  body: string
}

/** The screen for a backend that is not coming up, or null while it may still be waking. */
function problemFor(status: BackendState, httpStatus: number | null): Problem | null {
  switch (status) {
    case 'offline':
      return {
        tone: 'warning',
        icon: WifiOff,
        title: 'You are offline',
        body: 'Pulky needs an internet connection. It reconnects by itself once you are back online.',
      }
    case 'unreachable':
      return {
        tone: 'danger',
        icon: ServerOff,
        title: 'Could not reach the game server',
        body: 'It has not answered for over a minute. Check your internet connection and try again. If it keeps failing, the server may be down.',
      }
    case 'rejected':
      return {
        tone: 'danger',
        icon: ServerOff,
        title: 'The game server refused the connection',
        body: `It answered with an error (HTTP ${httpStatus ?? '4xx'}), so waiting will not help. This is a setup problem with the app, not with your connection.`,
      }
    default:
      return null
  }
}

export default function BackendWakeUp(): ReactElement {
  const { status, elapsedSeconds, httpStatus, retry } = useBackendStatus()
  const [retrying, setRetrying] = useState(false)
  const problem = problemFor(status, httpStatus)

  const tryAgain = (): void => {
    setRetrying(true)
    void retry().finally(() => setRetrying(false))
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4">
      <div
        role={problem ? 'alert' : undefined}
        className="flex w-full max-w-md flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 text-center shadow-card"
      >
        {problem ? (
          <>
            <span className={['grid size-14 place-items-center rounded-lg', TONE_CHIP[problem.tone]].join(' ')}>
              <problem.icon size={32} aria-hidden="true" className={TONE_MARK[problem.tone]} />
            </span>
            <h1 className="text-2xl">{problem.title}</h1>
            <p className="text-ink-muted">{problem.body}</p>
            <Button icon={RotateCw} loading={retrying} onClick={tryAgain}>
              Try again
            </Button>
          </>
        ) : (
          <>
            <span className="grid size-14 place-items-center rounded-lg bg-accent-subtle">
              <Server size={32} aria-hidden="true" className="text-accent" />
            </span>
            <h1 className="text-2xl">Waking up the game server</h1>
            <p className="text-ink-muted">The server sleeps when nobody is playing. Waking it takes up to a minute.</p>
            <div className="tabular-nums">
              <LoadingSpinner label={`${elapsedSeconds} s`} />
            </div>
          </>
        )}
      </div>
    </main>
  )
}
