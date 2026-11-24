import { ArrowLeft } from 'lucide-react'
import { useState, type ReactElement } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/http'
import { createRoomBatch } from '../api/rooms'
import BatchConfigForm from '../components/multihost/BatchConfigForm'
import AppHeader from '../components/shared/AppHeader'
import { InlineAlert } from '../components/shared/AlertContainer'
import type { PageRoute } from '../routes/registry'
import { setHostBatch, setHostSecret } from '../utils/storage'

export const route: PageRoute = { path: '/multihost/new', guard: 'auth+backend' }

/**
 * /multihost/new: one configuration, several games made with it at once
 * (`POST /rooms/batch-create`), then the dashboard (/multihost) that lists them.
 */
export default function MultiHostSetup(): ReactElement {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const create = async (count: number, patch: object, hostDisplayName: string): Promise<void> => {
    setSubmitting(true)
    setFailure(null)
    try {
      const { rooms } = await createRoomBatch(count, patch, hostDisplayName || undefined)
      // Store nothing unless every room came with its secret, so the dashboard never
      // lists a game it cannot host.
      if (rooms.length === 0 || rooms.some((room) => !room.host_secret)) {
        setFailure('The games were created but the server sent no host secret. Try again.')
        return
      }
      for (const room of rooms) setHostSecret(room.room_code, room.host_secret)
      setHostBatch(rooms.map((room) => room.room_code))
      navigate('/multihost')
    } catch (err) {
      setFailure(errorMessage(err, 'Could not create the games. Try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <AppHeader />
      <main id="main" className="mx-auto flex w-full max-w-config flex-col gap-6 px-4 py-6 md:px-6">
        <div className="flex flex-col gap-2">
          <Link to="/home" className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
            <ArrowLeft size={16} aria-hidden="true" />
            Home
          </Link>
          <h1 className="text-2xl">Host several games</h1>
          <p className="text-base text-ink-muted">
            Set the configuration once and create several games with it. Each game can still change its own
            settings from its host screen before it starts.
          </p>
        </div>
        {failure !== null ? <InlineAlert tone="danger">{failure}</InlineAlert> : null}
        <BatchConfigForm submitting={submitting} onCreate={(c, p, n) => void create(c, p, n)} />
      </main>
    </>
  )
}
