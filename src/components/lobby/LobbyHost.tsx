import { useState, type ReactElement } from 'react'
import { startGame } from '../../api/games'
import { useGameStore } from '../../store/gameStore'
import { InlineAlert } from '../shared/AlertContainer'
import InvitePanel from './InvitePanel'
import ParticipantList from './ParticipantList'
import StartControl from './StartControl'

interface LobbyHostProps {
  roomCode: string
  hostSecret: string | null
}

const NO_KEY = 'This browser does not hold the host key for this room.'

export default function LobbyHost({ roomCode, hostSecret }: LobbyHostProps): ReactElement {
  const participants = useGameStore((s) => s.participants)
  const seatsTotal = useGameStore((s) => s.seatsTotal)
  const canStart = useGameStore((s) => s.canStart)
  const startBlockedReason = useGameStore((s) => s.startBlockedReason)
  const joinError = useGameStore((s) => s.joinError)
  const lastSeq = useGameStore((s) => s.lastSeq)
  const alerts = useGameStore((s) => s.alerts)

  // Pending from the click until the next sequenced event (lobby_update, game_started) or join_error.
  const [clicked, setClicked] = useState<{ lastSeq: number; alerts: unknown } | null>(null)
  const pending = clicked !== null && clicked.lastSeq === lastSeq && clicked.alerts === alerts

  const handleStart = (): void => {
    if (hostSecret === null) return
    setClicked({ lastSeq, alerts })
    startGame(roomCode, hostSecret)
  }

  return (
    <div className="flex flex-col gap-4">
      {joinError ? <InlineAlert tone="danger">{joinError}</InlineAlert> : null}
      <InvitePanel roomCode={roomCode} />
      <ParticipantList participants={participants} seatsTotal={seatsTotal} />
      <StartControl
        canStart={canStart && hostSecret !== null}
        startBlockedReason={hostSecret === null ? NO_KEY : startBlockedReason}
        onStart={handleStart}
        pending={pending}
      />
    </div>
  )
}
