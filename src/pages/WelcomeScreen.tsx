import { Sprout } from 'lucide-react'
import { useState, type ReactElement } from 'react'
import { Navigate, useLocation, useNavigate, type Path } from 'react-router-dom'
import { errorMessage } from '../api/http'
import { useAuth } from '../auth/AuthContext'
import { InlineAlert } from '../components/shared/AlertContainer'
import Button from '../components/shared/Button'
import type { PageRoute } from '../routes/registry'

// eslint-disable-next-line react-refresh/only-export-components
export const route: PageRoute = { path: '/', guard: 'public' }

/** Where the visitor was headed before the guard sent them here, else /home (spec §13.6). */
function useDestination(): string | Partial<Path> {
  const state = useLocation().state as { from?: string | Partial<Path> } | null
  return state?.from ?? '/home'
}

export default function WelcomeScreen(): ReactElement {
  const { loading, mode, signInWithGoogle, continueAsGuest } = useAuth()
  const navigate = useNavigate()
  const destination = useDestination()
  const [signingIn, setSigningIn] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  // Only after auth has resolved: `mode` is not trustworthy while `loading`.
  if (!loading && mode === 'authenticated') return <Navigate to={destination} replace />

  const google = async (): Promise<void> => {
    setFailure(null)
    setSigningIn(true)
    try {
      await signInWithGoogle()
      navigate(destination, { replace: true })
    } catch (err) {
      const code = (err as { code?: unknown } | null)?.code
      // The user closing the popup is a choice, not a failure: show nothing.
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setFailure(errorMessage(err, 'Could not sign in with Google. Try again.'))
      }
    } finally {
      setSigningIn(false)
    }
  }

  const guest = (): void => {
    setFailure(null)
    continueAsGuest()
    navigate(destination, { replace: true })
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-lg border border-border bg-card p-8 text-center shadow-card">
        <span className="mx-auto grid size-10 place-items-center rounded-sm bg-accent">
          <Sprout size={24} aria-hidden="true" className="text-on-accent" />
        </span>
        <h1 className="text-3xl">Pulky</h1>
        <p className="text-ink-muted">Run a pulquería: buy, ship and sell pulque before it spoils.</p>
        <div className="flex flex-col gap-3">
          <Button variant="primary" size="lg" className="w-full" loading={signingIn} onClick={() => void google()}>
            Continue with Google
          </Button>
          <Button variant="secondary" size="lg" className="w-full" onClick={guest}>
            Play as guest
          </Button>
          {failure ? <InlineAlert tone="danger">{failure}</InlineAlert> : null}
        </div>
      </div>
    </main>
  )
}
