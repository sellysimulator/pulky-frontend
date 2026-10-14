import { useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import { join, leave } from '../../api/games'
import { useGameStore } from '../../store/gameStore'
import { getSessionToken, setDisplayName } from '../../utils/storage'
import Button from '../shared/Button'
import { InlineAlert } from '../shared/AlertContainer'
import LoadingSpinner from '../shared/LoadingSpinner'
import SectionCard from '../shared/SectionCard'
import NameForm from './NameForm'
import ParticipantList from './ParticipantList'

export default function LobbyPlayer({ roomCode }: { roomCode: string }): ReactElement {
  const navigate = useNavigate()
  const myAlias = useGameStore((s) => s.myAlias)
  const participants = useGameStore((s) => s.participants)
  const seatsTotal = useGameStore((s) => s.seatsTotal)
  const joinError = useGameStore((s) => s.joinError)
  const alerts = useGameStore((s) => s.alerts)

  // Pending until `joined` (myAlias set) or `join_error` (a new alert is raised with it).
  const [sentAt, setSentAt] = useState<unknown>(null)
  const pending = sentAt !== null && sentAt === alerts

  const handleSubmit = (name: string): void => {
    const trimmed = name.trim()
    if (trimmed !== '') setDisplayName(trimmed)
    setSentAt(alerts)
    join(roomCode, trimmed || null, getSessionToken(roomCode))
  }

  const handleLeave = (): void => {
    leave(roomCode)
    navigate('/home')
  }

  if (myAlias === null) {
    return (
      <SectionCard title="Name your pulquería">
        <div className="flex flex-col gap-4">
          {joinError ? <InlineAlert tone="danger">{joinError}</InlineAlert> : null}
          <NameForm onSubmit={handleSubmit} pending={pending} />
        </div>
      </SectionCard>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Waiting for the host to start">
        <div className="flex flex-col gap-4">
          <ParticipantList participants={participants} seatsTotal={seatsTotal} myAlias={myAlias} />
          <LoadingSpinner label="The game starts when the host presses Start." />
        </div>
      </SectionCard>
      <div>
        <Button variant="secondary" onClick={handleLeave}>
          Leave room
        </Button>
      </div>
    </div>
  )
}
