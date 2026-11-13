import { Copy, ExternalLink, QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useState, type ReactElement } from 'react'
import type { RoomSummary } from '../../types/game'
import { copyText } from '../../utils/clipboard'
import { inviteLink } from '../../utils/invite'
import Badge from '../shared/Badge'
import Button from '../shared/Button'
import JoinQrOverlay from '../shared/JoinQrOverlay'
import { openHostScreen, statusLabel } from './multihost'

interface GameCardProps {
  index: number
  roomCode: string
  summary: RoomSummary | undefined
}

function tone(summary: RoomSummary | undefined): 'neutral' | 'success' | 'info' | 'danger' {
  if (!summary) return 'neutral'
  if (!summary.exists) return 'danger'
  if (summary.can_start) return 'success'
  if (summary.state === 'running') return 'info'
  return 'neutral'
}

/** One game of the batch: its code, invite link and QR code, seats, status and a way
 * into its host screen. */
export default function GameCard({ index, roomCode, summary }: GameCardProps): ReactElement {
  const [showQr, setShowQr] = useState(false)
  const link = inviteLink(roomCode)
  const gone = summary !== undefined && !summary.exists
  const seats =
    summary?.exists && summary.seats_taken !== null ? `${summary.seats_taken} / ${summary.seats_total}` : '–'

  return (
    <article
      aria-label={`Game ${index + 1}`}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-card"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink-muted">Game {index + 1}</p>
          <p className="font-mono text-stat tracking-[0.2em] text-ink">{roomCode}</p>
        </div>
        <Badge tone={tone(summary)}>{statusLabel(summary)}</Badge>
      </header>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink-muted">Players</p>
          <p aria-label="Players" className="text-stat tabular-nums text-ink">
            {seats}
          </p>
        </div>
        {/* Click the code to show it full screen for a group to scan. A gone room gets
            none: nobody can join it. */}
        {gone ? null : (
          <button
            type="button"
            onClick={() => setShowQr(true)}
            aria-label={`Show QR code for game ${roomCode}`}
            className="shrink-0 cursor-pointer rounded-md border border-border bg-white p-1 hover:border-ink-subtle"
          >
            <QRCodeSVG value={link} size={96} level="M" marginSize={1} title={`Join link for game ${roomCode}`} />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-ink-muted">Invite link</p>
        <p aria-label={`Invite link for game ${roomCode}`} className="text-sm break-all text-ink">
          {link}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={Copy} onClick={() => void copyText(link)}>
            Copy link
          </Button>
          <Button size="sm" icon={QrCode} disabled={gone} aria-pressed={showQr} onClick={() => setShowQr((v) => !v)}>
            Show QR
          </Button>
        </div>
      </div>

      {showQr && !gone ? <JoinQrOverlay roomCode={roomCode} link={link} onClose={() => setShowQr(false)} /> : null}

      {/* A button, not a link: "open in new tab" from a link would not copy this tab's
          session storage, and the host secret with it. */}
      <Button variant="primary" icon={ExternalLink} disabled={gone} onClick={() => openHostScreen(roomCode)}>
        Open host screen
      </Button>
    </article>
  )
}
