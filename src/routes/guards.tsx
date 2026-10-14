import { createElement, type ReactElement, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useBackendStatus } from '../contexts/BackendStatusContext'
import { getShellComponent } from './registry'

const CHECKING_SIGN_IN = 'Checking your sign-in'
const WAKING_SERVER = 'Waking up the game server'

export function RequireAuth({ children }: { children: ReactNode }): ReactElement {
  const { loading, mode } = useAuth()
  const location = useLocation()

  if (loading) {
    const spinner = getShellComponent('LoadingSpinner')
    return spinner ? (
      createElement(spinner, { label: CHECKING_SIGN_IN })
    ) : (
      <p role="status">{CHECKING_SIGN_IN}</p>
    )
  }
  if (mode === null) return <Navigate to="/" replace state={{ from: location }} />
  return <>{children}</>
}

export function RequireBackend({ children }: { children: ReactNode }): ReactElement {
  const { status } = useBackendStatus()

  if (status === 'awake') return <>{children}</>
  const wakeUp = getShellComponent('BackendWakeUp')
  return wakeUp ? createElement(wakeUp) : <p role="status">{WAKING_SERVER}</p>
}
