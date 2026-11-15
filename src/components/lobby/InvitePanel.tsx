import { Copy, Link, QrCode } from 'lucide-react'
import { useState, type ReactElement } from 'react'
import { copyText } from '../../utils/clipboard'
import { inviteLink } from '../../utils/invite'
import Button from '../shared/Button'
import JoinQrOverlay from '../shared/JoinQrOverlay'

export default function InvitePanel({ roomCode }: { roomCode: string }): ReactElement {
  const link = inviteLink(roomCode)
  const [showQr, setShowQr] = useState(false)
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-card">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-ink-muted">Room code</p>
        <p className="font-mono text-stat tracking-[0.2em] text-ink">{roomCode}</p>
        <div>
          <Button size="sm" icon={Copy} onClick={() => void copyText(roomCode)}>
            Copy code
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-ink-muted">Invite link</p>
        <p className="text-sm break-all text-ink">{link}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={Link} onClick={() => void copyText(link)}>
            Copy link
          </Button>
          <Button size="sm" icon={QrCode} aria-pressed={showQr} onClick={() => setShowQr((v) => !v)}>
            {showQr ? 'Hide QR' : 'Show QR'}
          </Button>
        </div>
      </div>
      {/* Only the player link: the QR code never carries the host secret. */}
      {showQr ? <JoinQrOverlay roomCode={roomCode} link={link} onClose={() => setShowQr(false)} /> : null}
    </div>
  )
}
