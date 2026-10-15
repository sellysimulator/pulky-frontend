import { Copy, Link } from 'lucide-react'
import type { ReactElement } from 'react'
import { useGameStore } from '../../store/gameStore'
import Button from '../shared/Button'

async function copyText(text: string): Promise<void> {
  const addAlert = useGameStore.getState().addAlert
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
    await navigator.clipboard.writeText(text)
    addAlert({ kind: 'info', message: 'Copied.' })
  } catch {
    addAlert({ kind: 'error', message: 'Copy failed. Select the text and copy it.' })
  }
}

export default function InvitePanel({ roomCode }: { roomCode: string }): ReactElement {
  const link = `${window.location.origin}/join/${roomCode}`
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
        <div>
          <Button size="sm" icon={Link} onClick={() => void copyText(link)}>
            Copy link
          </Button>
        </div>
      </div>
    </div>
  )
}
