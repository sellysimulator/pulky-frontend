import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import {
  browserPopupRedirectResolver,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { auth, googleProvider } from '../../firebase'
import { errorMessage } from '../api/http'
import { socket } from '../api/socket'
import { upsertUser } from '../api/users'
import { useBackendStatus } from '../contexts/BackendStatusContext'
import { useGameStore } from '../store/gameStore'
import { getGuestMode, setGuestMode } from '../utils/storage'

interface AuthUser {
  displayName: string | null
  email: string | null
  photoURL: string | null
}

interface AuthContextValue {
  loading: boolean
  mode: 'authenticated' | 'guest' | null
  user: AuthUser | null
  signInWithGoogle(): Promise<void>
  continueAsGuest(): void
  signOut(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function toAuthUser(user: User): AuthUser {
  return { displayName: user.displayName, email: user.email, photoURL: user.photoURL }
}

export function AuthProvider({ children }: { children: ReactNode }): ReactElement {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [guest, setGuest] = useState<boolean>(() => getGuestMode())
  const awake = useBackendStatus().status === 'awake'
  // Bumped by each identity change; the effect below connects once the backend is awake.
  const [connectRequests, setConnectRequests] = useState(0)

  // A handshake sent to a sleeping server fails, so an earlier request waits for the first `awake`.
  useEffect(() => {
    if (awake && connectRequests > 0) socket.disconnect().connect()
  }, [awake, connectRequests])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ? toAuthUser(firebaseUser) : null)
      setLoading(false)
      setConnectRequests((n) => n + 1)
    })
    return unsubscribe
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const result = await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver)
    try {
      await upsertUser(result.user.displayName ?? undefined)
    } catch (err) {
      useGameStore.getState().addAlert({
        kind: 'error',
        message: errorMessage(err, 'Could not save your profile.'),
      })
    }
  }, [])

  const continueAsGuest = useCallback(() => {
    setGuestMode(true)
    setGuest(true)
    setConnectRequests((n) => n + 1)
  }, [])

  const signOut = useCallback(async () => {
    setGuestMode(false)
    setGuest(false)
    await firebaseSignOut(auth)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      mode: user ? 'authenticated' : guest ? 'guest' : null,
      user,
      signInWithGoogle,
      continueAsGuest,
      signOut,
    }),
    [loading, user, guest, signInWithGoogle, continueAsGuest, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (value === null) throw new Error('useAuth must be used inside AuthProvider.')
  return value
}
