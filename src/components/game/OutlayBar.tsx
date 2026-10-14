import { CircleAlert } from 'lucide-react'
import type { ReactElement } from 'react'
import { formatMoney } from '../../utils/format'
import Button from '../shared/Button'

interface OutlayBarProps {
  total: number
  cash: number
  over: boolean
  canSubmit: boolean
  onSubmit(): void
}

/** The live outlay against cash, then Submit day: the last control of the card (design.md §7.12). */
export default function OutlayBar({ total, cash, over, canSubmit, onSubmit }: OutlayBarProps): ReactElement {
  const ratio = over ? 1 : cash > 0 ? Math.min(1, Math.max(0, total / cash)) : 0
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-3 md:flex-row md:items-end md:justify-between">
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-base tabular-nums">
          Today: <span className="font-semibold">{formatMoney(total)}</span> of {formatMoney(cash)}
        </p>
        <div aria-hidden="true" className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-muted">
          <div className={['h-full rounded-full', over ? 'bg-danger' : 'bg-accent'].join(' ')} style={{ width: `${ratio * 100}%` }} />
        </div>
        {over ? (
          <p role="alert" className="flex items-center gap-1.5 text-sm text-danger-ink">
            <CircleAlert size={16} aria-hidden="true" className="text-danger" />
            {`Today's purchases cost ${formatMoney(total)} but you only have ${formatMoney(cash)}`}
          </p>
        ) : null}
      </div>
      <Button variant="primary" size="lg" disabled={!canSubmit} onClick={onSubmit}>
        Submit day
      </Button>
    </div>
  )
}
