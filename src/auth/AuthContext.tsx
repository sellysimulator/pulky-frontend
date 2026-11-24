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
import { clearPulkyStorage, getGuestMode, getOrCreateGuestId, hasGuestId, setGuestMode } from '../utils/storage'

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
  // Whether the last auth resolution had a Firebase user, read by the connect effect.
  const signedIn = useRef(false)

  // A handshake sent to a sleeping server fails, so an earlier request waits for the first `awake`.
  // With no Firebase user and no guest id there is no identity to send (first visit, after sign-out):
  // the socket stays down until the person signs in or continues as a guest (spec §11.3).
  useEffect(() => {
    if (!awake || connectRequests === 0) return
    if (!signedIn.current && !hasGuestId()) {
      socket.disconnect()
      return
    }
    socket.disconnect().connect()
  }, [awake, connectRequests])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      signedIn.current = firebaseUser !== null
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
    getOrCreateGuestId() // the identity the connect below sends
    setGuest(true)
    setConnectRequests((n) => n + 1)
  }, [])

  // Only a signed-in user signs out; a guest leaves guest mode only by signing in (spec §13.6).
  // Nothing of this person stays behind in storage, the store or the socket (a shared classroom machine).
  const signOut = useCallback(async () => {
    // Without a Firebase user there is nothing to sign out of, and a guest's identity must survive.
    if (auth.currentUser === null) return
    // Cleared first, so the guest id goes too: the socket then stays down until the next person
    // signs in or continues as a guest, who gets a fresh guest id.
    clearPulkyStorage()
    useGameStore.getState().reset()
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
