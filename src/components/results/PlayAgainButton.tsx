import { RotateCcw } from 'lucide-react'
import { useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import { errorMessage } from '../../api/http'
import { createRoom, putRoomConfig } from '../../api/rooms'
import { useGameStore } from '../../store/gameStore'
import { setHostSecret } from '../../utils/storage'
import { InlineAlert } from '../shared/AlertContainer'
import Button from '../shared/Button'

/** Block 6, host only: a finished room cannot restart, so this opens a new room with the same config and no seed. */
export default function PlayAgainButton({ roomCode }: { roomCode: string }): ReactElement | null {
  const navigate = useNavigate()
  const storeRoom = useGameStore((s) => s.roomCode)
  const config = useGameStore((s) => s.config)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  if (storeRoom !== roomCode || config === null || !('random_seed' in config)) return null

  const playAgain = async (): Promise<void> => {
    setFailure(null)
    setPending(true)
    try {
      const room = await createRoom()
      setHostSecret(room.room_code, room.host_secret)
      await putRoomConfig(room.room_code, room.host_secret, { ...config, random_seed: null })
      navigate(`/host/${room.room_code}`)
    } catch (err) {
      setFailure(errorMessage(err, 'Could not create the room. Try again.'))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button icon={RotateCcw} loading={pending} onClick={() => void playAgain()}>
          Play again
        </Button>
      </div>
      {failure !== null ? <InlineAlert tone="danger">{failure}</InlineAlert> : null}
    </div>
  )
}
