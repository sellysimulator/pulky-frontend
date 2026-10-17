import { FileClock, ShoppingCart, type LucideIcon } from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'
import { LIMITS, WEEKDAYS, type PlayerView, type Weekday } from '../../types/game'
import { formatMoney, formatQty, weekdayShort } from '../../utils/format'
import NumberField from '../shared/NumberField'

const ORDER_ERROR = `Orders must be whole numbers from 0 to ${formatQty(LIMITS.MAX_ORDER)}.`

function isValidQuantity(value: number | null): boolean {
  return value !== null && Number.isInteger(value) && value >= 0 && value <= LIMITS.MAX_ORDER
}

function weekdayOn(view: PlayerView, day: number): Weekday {
  const start = WEEKDAYS.indexOf(view.weekday)
  return WEEKDAYS[(((start + day - view.day) % 7) + 7) % 7]
}

/** One row of the decision card: concept icon and label, then the control. */
export function FormRow({ icon: Icon, label, children }: { icon: LucideIcon; label?: string; children: ReactNode }): ReactElement {
  return (
    <div className="grid gap-x-4 gap-y-1 border-t border-border py-3 md:grid-cols-[9rem_minmax(0,1fr)]">
      <div className="flex items-start gap-2 pt-2.5 font-semibold">
        <Icon size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
        {label ? <span>{label}</span> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

interface OrderSectionProps {
  kind: 'spot' | 'futures'
  view: PlayerView
  value: number | null
  onChange(value: number | null): void
  locked: boolean
}

export default function OrderSection({ kind, view, value, onChange, locked }: OrderSectionProps): ReactElement {
  const spot = kind === 'spot'
  const open = spot ? view.order_windows.spot_open : view.order_windows.futures_open
  const brief = view.brief
  let context: ReactNode = null
  if (!open) {
    context = spot ? view.order_windows.spot_message : view.order_windows.futures_message
  } else if (brief) {
    context = spot
      ? `at ${formatMoney(brief.supplier.spot_price)} · capacity ${formatQty(brief.supplier.capacity)} · arrives day ${brief.spot.arrives_day} (${weekdayShort(weekdayOn(view, brief.spot.arrives_day))})`
      : `at ${formatMoney(brief.futures.price)}, paid today · delivered day ${brief.futures.delivery_day} · ${view.order_windows.futures_message}`
  }
  const shown = open ? value : 0
  return (
    <FormRow icon={spot ? ShoppingCart : FileClock} label={spot ? 'Spot' : 'Futures'}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
        <NumberField
          label={spot ? 'Spot' : 'Futures'}
          hideLabel
          kind="quantity"
          min={0}
          max={LIMITS.MAX_ORDER}
          value={shown}
          onChange={onChange}
          disabled={!open}
          readOnly={locked}
          error={open && !isValidQuantity(value) ? ORDER_ERROR : undefined}
        />
        {context ? <p className="min-w-0 flex-1 pt-2.5 text-sm text-ink-muted tabular-nums">{context}</p> : null}
      </div>
    </FormRow>
  )
}
