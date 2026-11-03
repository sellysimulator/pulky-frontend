import { CircleAlert } from 'lucide-react'
import type { ReactElement } from 'react'
import { PREVIEW_PLACEHOLDER, formatMoney } from '../../utils/format'
import Button from '../shared/Button'

interface OutlayBarProps {
  /** The server's outlay for the draft (spec §8.3, §12.4); null while it loads or while an order is in error. */
  total: number | null
  pending: boolean
  cash: number
  /** The server's message when the draft costs more than the cash (spec §4.3), else null. */
  unaffordable: string | null
  canSubmit: boolean
  onSubmit(): void
}

/** The live outlay against cash, then Submit day: the last control of the card (design.md §7.12). */
export default function OutlayBar({ total, pending, cash, unaffordable, canSubmit, onSubmit }: OutlayBarProps): ReactElement {
  const over = unaffordable !== null
  const ratio = total === null ? 0 : over ? 1 : cash > 0 ? Math.min(1, Math.max(0, total / cash)) : 0
  const shown = total === null ? (pending ? PREVIEW_PLACEHOLDER : '—') : formatMoney(total)
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-3 md:flex-row md:items-end md:justify-between">
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-base tabular-nums" aria-busy={pending || undefined}>
          Today: <span className="font-semibold">{shown}</span> of {formatMoney(cash)}
        </p>
        <div aria-hidden="true" className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-muted">
          <div className={['h-full rounded-full', over ? 'bg-danger' : 'bg-accent'].join(' ')} style={{ width: `${ratio * 100}%` }} />
        </div>
        {over ? (
          <p role="alert" className="flex items-center gap-1.5 text-sm text-danger-ink">
            <CircleAlert size={16} aria-hidden="true" className="text-danger" />
            {unaffordable}
          </p>
        ) : null}
      </div>
      <Button variant="primary" size="lg" disabled={!canSubmit} onClick={onSubmit}>
        Submit day
      </Button>
    </div>
  )
}
