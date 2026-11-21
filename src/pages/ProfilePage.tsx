import { CircleUser } from 'lucide-react'
import { useEffect, useState, type ReactElement } from 'react'
import { useParams } from 'react-router-dom'
import { auth } from '../../firebase'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../api/http'
import { getMe, getMyGames, getMyHostedGames, getMyStats } from '../api/users'
import GameDetail from '../components/profile/GameDetail'
import GamesTable from '../components/profile/GamesTable'
import HostedGamesTable from '../components/profile/HostedGamesTable'
import ProfileHeader from '../components/profile/ProfileHeader'
import ProfileStats from '../components/profile/ProfileStats'
import { InlineAlert } from '../components/shared/AlertContainer'
import AppHeader from '../components/shared/AppHeader'
import Button from '../components/shared/Button'
import EmptyState from '../components/shared/EmptyState'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import type { PageRoute } from '../routes/registry'
import type { HostedGameRow, MyGameRow, UserMe, UserStats } from '../types/game'

// eslint-disable-next-line react-refresh/only-export-components
export const route: PageRoute[] = [
  { path: '/profile', guard: 'auth+backend' },
  { path: '/profile/games/:publicId', guard: 'auth+backend' },
]

type Loaded =
  | { kind: 'ok'; me: UserMe; stats: UserStats; games: MyGameRow[] }
  | { kind: 'error'; message: string }

function ProfileOverview(): ReactElement {
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([getMe(), getMyStats(), getMyGames()]).then(
      ([me, stats, games]) => {
        if (!cancelled) setLoaded({ kind: 'ok', me, stats, games })
      },
      (err: unknown) => {
        if (!cancelled) setLoaded({ kind: 'error', message: errorMessage(err, 'Could not load your profile.') })
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  if (loaded === null) return <LoadingSpinner label="Loading your profile" />
  if (loaded.kind === 'error') return <InlineAlert tone="danger">{loaded.message}</InlineAlert>
  return (
    <>
      <ProfileHeader me={loaded.me} />
      <ProfileStats stats={loaded.stats} />
      <GamesTable games={loaded.games} />
    </>
  )
}

type HostedLoaded = { kind: 'ok'; games: HostedGameRow[] } | { kind: 'error' }

/**
 * Games you hosted: their own request, loading and error, so a failure here (an older backend, a
 * transient error) leaves the profile, its played games and its stats on screen (spec §13.4).
 */
function ProfileHostedGames(): ReactElement {
  const [loaded, setLoaded] = useState<HostedLoaded | null>(null)

  // State starts fresh because the parent keys this on the uid; no sync setState here.
  useEffect(() => {
    let cancelled = false
    getMyHostedGames().then(
      (games) => {
        if (!cancelled) setLoaded({ kind: 'ok', games })
      },
      () => {
        if (!cancelled) setLoaded({ kind: 'error' })
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  if (loaded === null) return <LoadingSpinner label="Loading the games you hosted" />
  if (loaded.kind === 'error') return <InlineAlert tone="danger">Could not load the games you hosted.</InlineAlert>
  return <HostedGamesTable games={loaded.games} />
}

export default function ProfilePage(): ReactElement {
  const { mode, signInWithGoogle } = useAuth()
  const { publicId } = useParams()

  let body: ReactElement
  if (mode === 'guest') {
    body = (
      <EmptyState
        icon={CircleUser}
        title="Sign in to see your profile"
        body="Games you play signed in are saved here."
        action={
          <Button variant="primary" onClick={() => void signInWithGoogle()}>
            Sign in with Google
          </Button>
        }
      />
    )
  } else if (publicId !== undefined) {
    body = <GameDetail publicId={publicId} />
  } else {
    // Keyed on Firebase's uid, read here so it never enters the auth context: another signed-in
    // user remounts the hosted list with fresh state (an auth change re-renders this page).
    body = (
      <>
        <ProfileOverview />
        <ProfileHostedGames key={`hosted-${auth.currentUser?.uid ?? ''}`} />
      </>
    )
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <AppHeader />
      <main className="mx-auto flex max-w-player flex-col gap-6 px-4 py-8">{body}</main>
    </div>
  )
}
