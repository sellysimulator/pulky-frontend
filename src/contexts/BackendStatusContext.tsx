import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { probeHealth, type HealthResult } from '../api/health'

/**
 * `checking` until the first probe answers. Then `waking` while there is no
 * answer inside `wakeWindowMs` (a cold start), `unreachable` once there is
 * none for longer, `offline` while the browser reports no network, and
 * `rejected` when the server answers with a 4xx. Every state except `awake`
 * keeps polling, so the screen recovers by itself.
 */
export type BackendState = 'checking' | 'awake' | 'waking' | 'unreachable' | 'offline' | 'rejected'

interface BackendStatus {
  status: BackendState
  elapsedSeconds: number
  /** The HTTP status of a `rejected` answer, otherwise null. */
  httpStatus: number | null
  /** Probes now instead of at the next poll; resolves once that probe has answered. */
  retry: () => Promise<void>
}

const BackendStatusContext = createContext<BackendStatus>({
  status: 'checking',
  elapsedSeconds: 0,
  httpStatus: null,
  retry: async () => undefined,
})

export function BackendStatusProvider({
  children,
  pollMs = 3000,
  wakeWindowMs = 90_000,
}: {
  children: ReactNode
  pollMs?: number
  wakeWindowMs?: number
}): ReactElement {
  const [status, setStatus] = useState<BackendState>('checking')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [httpStatus, setHttpStatus] = useState<number | null>(null)
  const probeNow = useRef<() => Promise<void>>(async () => undefined)

  useEffect(() => {
    let cancelled = false
    let awake = false
    let inFlight: Promise<void> | null = null
    let retry: ReturnType<typeof setTimeout> | undefined
    let waitStartedAt = Date.now()
    const clock = setInterval(() => setElapsedSeconds((s) => s + 1), 1000)

    const settle = (result: HealthResult): void => {
      if (result.outcome === 'ok') {
        awake = true
        clearInterval(clock)
        setStatus('awake')
        return
      }
      if (result.outcome === 'rejected') {
        setHttpStatus(result.httpStatus)
        setStatus('rejected')
      } else {
        setHttpStatus(null)
        if (!navigator.onLine) setStatus('offline')
        else setStatus(Date.now() - waitStartedAt >= wakeWindowMs ? 'unreachable' : 'waking')
      }
      retry = setTimeout(() => void probe(), pollMs)
    }

    const probe = (): Promise<void> => {
      if (cancelled || awake) return Promise.resolve()
      if (inFlight) return inFlight
      clearTimeout(retry)
      inFlight = probeHealth().then((result) => {
        inFlight = null
        if (!cancelled) settle(result)
      })
      return inFlight
    }

    // Back online, the backend may never have been asked: the cold-start allowance starts over.
    const onOnline = (): void => {
      waitStartedAt = Date.now()
      setElapsedSeconds(0)
      void probe()
    }

    window.addEventListener('online', onOnline)
    probeNow.current = probe
    void probe()

    return () => {
      cancelled = true
      clearInterval(clock)
      clearTimeout(retry)
      window.removeEventListener('online', onOnline)
    }
  }, [pollMs, wakeWindowMs])

  const retry = useCallback(() => probeNow.current(), [])

  const value = useMemo(
    () => ({ status, elapsedSeconds, httpStatus, retry }),
    [status, elapsedSeconds, httpStatus, retry],
  )

  return <BackendStatusContext.Provider value={value}>{children}</BackendStatusContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBackendStatus(): BackendStatus {
  return useContext(BackendStatusContext)
}
