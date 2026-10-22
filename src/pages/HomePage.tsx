import { UserCog, UsersRound } from 'lucide-react'
import { useState, type FormEvent, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/http'
import { createRoom, getRoomStatus } from '../api/rooms'
import { ManualLinks } from '../components/manual/ManualLink'
import AppHeader from '../components/shared/AppHeader'
import { InlineAlert } from '../components/shared/AlertContainer'
import Button from '../components/shared/Button'
import SectionCard from '../components/shared/SectionCard'
import type { PageRoute } from '../routes/registry'
import { LIMITS } from '../types/game'
import { getSessionToken, setHostSecret } from '../utils/storage'

// eslint-disable-next-line react-refresh/only-export-components
export const route: PageRoute = { path: '/home', guard: 'auth+backend' }

/** Spec §11.3: the 6-character room code alphabet. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6

const FIELD =
  'h-11 w-full rounded-md border border-border-control bg-card px-3 text-base hover:border-ink-subtle focus:border-accent'

function JoinCard(): ReactElement {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [reason, setReason] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (pending || code === '') return
    setReason(null)
    setPending(true)
    try {
      const status = await getRoomStatus(code)
      if (status.ok || getSessionToken(code) !== null) navigate(`/game/${code}`)
      else setReason(status.reason ?? 'Could not reach the game server.')
    } catch (err) {
      setReason(errorMessage(err, 'Could not reach the game server.'))
    } finally {
      setPending(false)
    }
  }

  return (
    <SectionCard title="Join a room" icon={UsersRound}>
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="room-code" className="text-base font-medium">
            Room code
          </label>
          <input
            id="room-code"
            name="room_code"
            type="text"
            value={code}
            maxLength={CODE_LENGTH}
            required
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(e) =>
              setCode(
                Array.from(e.target.value.toUpperCase())
                  .filter((c) => CODE_ALPHABET.includes(c))
                  .join('')
                  .slice(0, CODE_LENGTH),
              )
            }
            className="h-14 w-full rounded-md border border-border-control bg-card px-3 text-center font-mono text-2xl tracking-[0.3em] uppercase hover:border-ink-subtle focus:border-accent"
          />
          {reason ? <InlineAlert tone="danger">{reason}</InlineAlert> : null}
        </div>
        <Button type="submit" variant="primary" loading={pending}>
          Join
        </Button>
      </form>
    </SectionCard>
  )
}

function CreateCard(): ReactElement {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [failure, setFailure] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (pending) return
    setFailure(null)
    setPending(true)
    try {
      const room = await createRoom(name.trim())
      setHostSecret(room.room_code, room.host_secret)
      navigate(`/host/${room.room_code}`)
    } catch (err) {
      setFailure(errorMessage(err, 'Could not create the room. Try again.'))
    } finally {
      setPending(false)
    }
  }

  return (
    <SectionCard title="Create a room" icon={UserCog}>
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="host-name" className="text-base font-medium">
            Your name
          </label>
          <input
            id="host-name"
            name="host_display_name"
            type="text"
            value={name}
            maxLength={LIMITS.MAX_DISPLAY_NAME}
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
            className={FIELD}
          />
          {failure ? <InlineAlert tone="danger">{failure}</InlineAlert> : null}
        </div>
        <Button type="submit" variant="secondary" loading={pending}>
          Create room
        </Button>
      </form>
    </SectionCard>
  )
}

export default function HomePage(): ReactElement {
  return (
    <>
      <AppHeader />
      <main id="main" className="mx-auto flex w-full max-w-form flex-col gap-4 px-4 py-8 md:px-6">
        <JoinCard />
        <CreateCard />
        <ManualLinks />
      </main>
    </>
  )
}
