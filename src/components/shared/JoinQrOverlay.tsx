import { X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactElement } from 'react'
import Button from './Button'

interface JoinQrOverlayProps {
  roomCode: string
  /** The player invite link the code encodes (`/join/:roomCode`); never a host secret. */
  link: string
  onClose(): void
}

/**
 * A full-screen QR code of a room's invite link, sized to be projected for a class to
 * scan. A native dialog like `ConfirmDialog`: Escape, a click on the backdrop or
 * **Close** dismisses it. The code is drawn in the browser (qrcode.react), so the link
 * is sent to no QR service. Mount it only while it is shown.
 */
export default function JoinQrOverlay({ roomCode, link, onClose }: JoinQrOverlayProps): ReactElement {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal()
    } else {
      dialog.setAttribute('open', '')
    }
    dialog.querySelector<HTMLButtonElement>('[data-close]')?.focus()
    return () => {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close()
    }
  }, [])

  const handleKeyDown = (e: KeyboardEvent<HTMLDialogElement>): void => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    onClose()
  }
  // A click whose target is the dialog itself landed on the backdrop, outside the card.
  const handleClick = (e: MouseEvent<HTMLDialogElement>): void => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <dialog
      ref={ref}
      aria-label={`QR code to join room ${roomCode}`}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none items-center justify-center bg-transparent pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] text-ink open:flex backdrop:bg-overlay"
    >
      <div className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-lg bg-card p-6 shadow-raised">
        <div className="flex w-full items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink-muted">Scan to join</p>
            <p className="font-mono text-figure tracking-[0.2em] text-ink">{roomCode}</p>
          </div>
          <Button variant="ghost" size="sm" aria-label="Close QR code" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </Button>
        </div>
        <div className="aspect-square w-full max-w-[min(80vw,62vh)] bg-white p-2">
          <QRCodeSVG
            value={link}
            size={512}
            level="M"
            marginSize={2}
            title={`Join link for room ${roomCode}`}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
        <p className="text-center text-base break-all text-ink-muted">{link}</p>
        <Button variant="primary" data-close="" onClick={onClose}>
          Close
        </Button>
      </div>
    </dialog>
  )
}
