import { useState, type ReactElement } from 'react'
import { claimGames } from '../../api/results'
import { errorMessage } from '../../api/http'
import { useAuth } from '../../auth/AuthContext'
import { getGuestId, hasPlayedGame } from '../../utils/storage'
import { InlineAlert } from '../shared/AlertContainer'
import Button from '../shared/Button'

/** Block 6, guests only: sign in with Google, then attach this browser's guest games to the account. */
export default function GuestClaimPrompt({ gameId }: { gameId: string }): ReactElement | null {
  const { mode, signInWithGoogle } = useAuth()
  const [pending, setPending] = useState(false)
  const [claimed, setClaimed] = useState<number | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  if (claimed !== null) {
    return <InlineAlert tone="success">{claimed === 1 ? `Saved ${claimed} game to your profile.` : `Saved ${claimed} games to your profile.`}</InlineAlert>
  }

  const guestId = getGuestId()
  if (mode !== 'guest' || guestId === null || !hasPlayedGame(gameId)) return null

  const claim = async (): Promise<void> => {
    setFailure(null)
    setPending(true)
    try {
      await signInWithGoogle()
      const result = await claimGames(guestId)
      setClaimed(result.claimed)
    } catch (err) {
      setFailure(errorMessage(err, 'Could not save your results. Try again.'))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <InlineAlert tone="info">
        <div className="flex flex-wrap items-center gap-3">
          <p>Sign in to keep these results in your profile.</p>
          <Button variant="primary" loading={pending} onClick={() => void claim()}>
            Sign in with Google
          </Button>
        </div>
      </InlineAlert>
      {failure !== null ? <InlineAlert tone="danger">{failure}</InlineAlert> : null}
    </div>
  )
}
