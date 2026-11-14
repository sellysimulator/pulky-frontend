import { Check, Download } from 'lucide-react'
import { useState, type ReactElement } from 'react'
import { errorMessage } from '../../api/http'
import { exportGame } from '../../api/results'
import { hasExported, markExported, type ExportFormat } from '../../utils/storage'
import { InlineAlert } from '../shared/AlertContainer'
import Button from '../shared/Button'

const FORMATS: ReadonlyArray<{ format: ExportFormat; label: string }> = [
  { format: 'csv', label: 'CSV' },
  { format: 'json', label: 'JSON' },
]

interface ExportControlsProps {
  gameId: string
  roomCode: string
}

/**
 * Block 6, for every viewer of the results: saves `pulky-{ROOM}-{id8}.csv` or `.json`, the
 * server's file name. The export is open by game id, like the results (spec §13.4).
 *
 * Each format downloads once per browser session (`hasExported` / `markExported`): after a
 * download its button is disabled and says so. That is UX only, to spare the server repeat
 * clicks; the server's per-IP export limit (spec §0.6) is the real guard.
 */
export default function ExportControls({ gameId, roomCode }: ExportControlsProps): ReactElement {
  const [pending, setPending] = useState<ExportFormat | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  // Bumped after a download so the buttons re-read the session flags.
  const [, setDownloads] = useState(0)

  const download = async (format: ExportFormat): Promise<void> => {
    setFailure(null)
    setPending(format)
    try {
      const blob = await exportGame(gameId, format)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `pulky-${roomCode.toUpperCase()}-${gameId.slice(0, 8)}.${format}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      markExported(gameId, format)
      setDownloads((n) => n + 1)
    } catch (err) {
      setFailure(errorMessage(err, 'Export failed. Try again.'))
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {FORMATS.map(({ format, label }) => {
          const done = hasExported(gameId, format)
          return (
            <Button
              key={format}
              icon={done ? Check : Download}
              loading={pending === format}
              disabled={done || pending !== null}
              onClick={() => void download(format)}
            >
              {done ? `${label} already downloaded this session` : `Export ${label}`}
            </Button>
          )
        })}
      </div>
      <p className="text-sm text-ink-muted">Anyone who can see these results can download the game's data, each format once per browser session.</p>
      {failure !== null ? <InlineAlert tone="danger">{failure}</InlineAlert> : null}
    </div>
  )
}
