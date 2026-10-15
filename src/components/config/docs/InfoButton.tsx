import { Info } from 'lucide-react'
import { useRef, useState, type ReactElement } from 'react'
import type { GameConfig } from '../../../types/game'
import HelpDialog from './HelpDialog'
import { DOCS } from './entries'

/** A ghost icon button that opens the help dialog of one config knob (design.md §7.15). */
export default function InfoButton({ entryKey, config }: { entryKey: string; config: GameConfig }): ReactElement {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const label = (DOCS[entryKey] as (typeof DOCS)[string] | undefined)?.label ?? entryKey

  const close = (): void => {
    setOpen(false)
    button.current?.focus()
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={`About ${label}`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="relative inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-accent hover:bg-muted after:absolute after:-inset-2 after:content-['']"
      >
        <Info size={18} aria-hidden="true" />
      </button>
      <HelpDialog entryKey={entryKey} config={config} open={open} onClose={close} />
    </>
  )
}
