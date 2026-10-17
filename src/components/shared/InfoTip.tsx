import { Info } from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'
import Tooltip from './Tooltip'

interface InfoTipProps {
  /** What the tip explains; the button's accessible name is "About {label}". */
  label: string
  children: ReactNode
}

/** A ghost info icon whose Tooltip holds the detail a screen does not need to show at all times (design.md §7.15). */
export default function InfoTip({ label, children }: InfoTipProps): ReactElement {
  return (
    <Tooltip content={<span className="flex flex-col gap-1">{children}</span>}>
      <button
        type="button"
        aria-label={`About ${label}`}
        // Safari does not focus a button on tap, so a tap focuses it to open the tip on touch screens.
        onClick={(e) => e.currentTarget.focus()}
        className="relative inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-muted transition-colors duration-150 hover:bg-muted hover:text-ink after:absolute after:-inset-2.5 after:content-['']"
      >
        <Info size={16} aria-hidden="true" />
      </button>
    </Tooltip>
  )
}
