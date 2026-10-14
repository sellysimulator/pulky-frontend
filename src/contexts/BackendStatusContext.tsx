import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { probeHealth } from '../api/health'

interface BackendStatus {
  status: 'checking' | 'awake' | 'waking'
  elapsedSeconds: number
}

const BackendStatusContext = createContext<BackendStatus>({
  status: 'checking',
  elapsedSeconds: 0,
})

export function BackendStatusProvider({
  children,
  pollMs = 3000,
}: {
  children: ReactNode
  pollMs?: number
}): ReactElement {
  const [status, setStatus] = useState<BackendStatus['status']>('checking')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    let cancelled = false
    let retry: ReturnType<typeof setTimeout> | undefined
    const clock = setInterval(() => setElapsedSeconds((s) => s + 1), 1000)

    const probe = async (): Promise<void> => {
      const awake = await probeHealth()
      if (cancelled) return
      if (awake) {
        clearInterval(clock)
        setStatus('awake')
        return
      }
      setStatus('waking')
      retry = setTimeout(() => void probe(), pollMs)
    }
    void probe()

    return () => {
      cancelled = true
      clearInterval(clock)
      if (retry !== undefined) clearTimeout(retry)
    }
  }, [pollMs])

  const value = useMemo(() => ({ status, elapsedSeconds }), [status, elapsedSeconds])

  return <BackendStatusContext.Provider value={value}>{children}</BackendStatusContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBackendStatus(): BackendStatus {
  return useContext(BackendStatusContext)
}
