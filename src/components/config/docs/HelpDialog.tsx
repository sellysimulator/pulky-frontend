import { X } from 'lucide-react'
import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent, type ReactElement } from 'react'
import type { GameConfig } from '../../../types/game'
import Button from '../../shared/Button'
import { DOCS } from './entries'

interface HelpDialogProps {
  entryKey: string
  config: GameConfig
  open: boolean
  onClose(): void
}

/**
 * The help dialog of one config knob (design.md §7.15): a native dialog with
 * the entry's label, then Formula, How it changes the game and Example.
 */
export default function HelpDialog({ entryKey, config, open, onClose }: HelpDialogProps): ReactElement | null {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const entry = DOCS[entryKey] as (typeof DOCS)[string] | undefined

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open) {
      if (typeof dialog.showModal === 'function') {
        if (!dialog.open) dialog.showModal()
      } else {
        dialog.setAttribute('open', '')
      }
      dialog.querySelector<HTMLButtonElement>('[data-close]')?.focus()
    } else if (typeof dialog.close === 'function') {
      if (dialog.open) dialog.close()
    } else {
      dialog.removeAttribute('open')
    }
  }, [open])

  if (!entry) return null

  const handleKeyDown = (e: KeyboardEvent<HTMLDialogElement>): void => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    onClose()
  }
  // A click whose target is the dialog itself landed on the backdrop.
  const handleClick = (e: MouseEvent<HTMLDialogElement>): void => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      className="m-auto max-h-[85vh] w-[min(44rem,calc(100vw-2rem))] overflow-hidden rounded-lg bg-card p-0 text-ink shadow-raised backdrop:bg-overlay"
    >
      {open ? (
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-border bg-inset px-5 py-4">
            <h2 id={titleId} className="text-lg">
              {entry.label}
            </h2>
            <Button variant="ghost" size="sm" data-close="" aria-label="Close" onClick={onClose}>
              <X size={18} aria-hidden="true" />
            </Button>
          </header>
          <div className="flex flex-col gap-5 overflow-y-auto px-5 py-4">
            <section className="flex flex-col gap-2">
              <h3 className="text-base font-semibold">Formula</h3>
              {entry.formula(config)}
            </section>
            <section className="flex flex-col gap-2">
              <h3 className="text-base font-semibold">How it changes the game</h3>
              <p className="text-base text-ink">{entry.effect}</p>
            </section>
            <section className="flex flex-col gap-2">
              <h3 className="text-base font-semibold">Example</h3>
              {entry.example(config)}
            </section>
          </div>
        </div>
      ) : null}
    </dialog>
  )
}
