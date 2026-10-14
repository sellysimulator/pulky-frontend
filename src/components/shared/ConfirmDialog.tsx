import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent, type ReactElement, type ReactNode } from 'react'
import Button from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  body: ReactNode
  confirmLabel: string
  cancelLabel?: string
  onConfirm(): void
  onCancel(): void
}

/**
 * A native dialog. Where `showModal` exists the browser traps focus and
 * handles Escape; where it does not (jsdom) the `open` attribute stands in.
 */
export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps): ReactElement {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open) {
      if (typeof dialog.showModal === 'function') {
        if (!dialog.open) dialog.showModal()
      } else {
        dialog.setAttribute('open', '')
      }
      dialog.querySelector<HTMLButtonElement>('[data-cancel]')?.focus()
    } else if (typeof dialog.close === 'function') {
      if (dialog.open) dialog.close()
    } else {
      dialog.removeAttribute('open')
    }
  }, [open])

  const handleKeyDown = (e: KeyboardEvent<HTMLDialogElement>): void => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    onCancel()
  }
  // A click whose target is the dialog itself landed on the backdrop.
  const handleClick = (e: MouseEvent<HTMLDialogElement>): void => {
    if (e.target === e.currentTarget) onCancel()
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
      className="m-auto w-[calc(100vw-2rem)] max-w-md bg-transparent p-0 text-ink backdrop:bg-overlay"
    >
      {open ? (
        <div className="rounded-lg bg-card p-6 shadow-raised">
          <h2 id={titleId} className="text-lg">
            {title}
          </h2>
          <div className="mt-2 text-base text-ink-muted">{body}</div>
          <div className="mt-6 flex justify-end gap-3">
            <Button data-cancel="" autoFocus onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button variant="destructive-solid" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      ) : null}
    </dialog>
  )
}
