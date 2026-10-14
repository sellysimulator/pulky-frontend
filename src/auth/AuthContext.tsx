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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ? toAuthUser(firebaseUser) : null)
      setLoading(false)
      socket.disconnect().connect()
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
    socket.disconnect().connect()
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
