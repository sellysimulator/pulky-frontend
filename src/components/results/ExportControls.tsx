import { Download } from 'lucide-react'
import { useState, type ReactElement } from 'react'
import { errorMessage } from '../../api/http'
import { exportGame } from '../../api/results'
import { InlineAlert } from '../shared/AlertContainer'
import Button from '../shared/Button'

type Format = 'csv' | 'json'

const FORBIDDEN = 'Only the host who created this room can export it.'

interface ExportControlsProps {
  gameId: string
  roomCode: string
  hostSecret: string | null
}

/** Block 6, host only: saves `pulky-{ROOM}-{id8}.csv` or `.json`, the server's file name. */
export default function ExportControls({ gameId, roomCode, hostSecret }: ExportControlsProps): ReactElement {
  const [pending, setPending] = useState<Format | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const download = async (format: Format): Promise<void> => {
    setFailure(null)
    setPending(format)
    try {
      const blob = await exportGame(gameId, format, hostSecret)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `pulky-${roomCode.toUpperCase()}-${gameId.slice(0, 8)}.${format}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      const status = (err as { response?: { status?: number } } | null)?.response?.status
      setFailure(status === 403 ? FORBIDDEN : errorMessage(err, 'Export failed. Try again.'))
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <Button icon={Download} loading={pending === 'csv'} disabled={pending !== null} onClick={() => void download('csv')}>
          Export CSV
        </Button>
        <Button icon={Download} loading={pending === 'json'} disabled={pending !== null} onClick={() => void download('json')}>
          Export JSON
        </Button>
      </div>
      <p className="text-sm text-ink-muted">Download the data during the debrief: the room expires 24 hours after its last activity.</p>
      {failure !== null ? <InlineAlert tone="danger">{failure}</InlineAlert> : null}
    </div>
  )
}
