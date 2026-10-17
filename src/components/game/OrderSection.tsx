import { FileClock, ShoppingCart, type LucideIcon } from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'
import { LIMITS, WEEKDAYS, type PlayerView, type Weekday } from '../../types/game'
import { formatMoney, formatQty, weekdayLong } from '../../utils/format'
import Badge from '../shared/Badge'
import InfoTip from '../shared/InfoTip'
import NumberField from '../shared/NumberField'

const ORDER_ERROR = `Orders must be whole numbers from 0 to ${formatQty(LIMITS.MAX_ORDER)}.`

function isValidQuantity(value: number | null): boolean {
  return value !== null && Number.isInteger(value) && value >= 0 && value <= LIMITS.MAX_ORDER
}

function weekdayOn(view: PlayerView, day: number): Weekday {
  const start = WEEKDAYS.indexOf(view.weekday)
  return WEEKDAYS[(((start + day - view.day) % 7) + 7) % 7]
}

interface FormRowProps {
  icon: LucideIcon
  label?: string
  /** An InfoTip beside the label: the row's explanation, kept off the screen until asked for. */
  info?: ReactNode
  children: ReactNode
}

/** One row of the decision card: concept icon, label and info tip, then the control. */
export function FormRow({ icon: Icon, label, info, children }: FormRowProps): ReactElement {
  return (
    <div className="grid gap-x-4 gap-y-1 border-t border-border py-3 md:grid-cols-[13rem_minmax(0,1fr)]">
      <div className="flex items-start gap-2 pt-2.5 font-semibold">
        <Icon size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
        {label ? <span>{label}</span> : null}
        {info ? <span className="-mt-0.5">{info}</span> : null}
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

function dayLabel(view: PlayerView, day: number): string {
  return `day ${day} (${weekdayLong(weekdayOn(view, day))})`
}

function countdown(daysLeft: number): string {
  return daysLeft === 1 ? 'Last day to buy' : `${daysLeft} days left to buy`
}

function SpotInfo({ view }: { view: PlayerView }): ReactElement {
  const brief = view.brief
  return (
    <InfoTip label="Buy from Supplier">
      <span>
        Bought at today&apos;s spot price
        {brief ? `, arriving on ${dayLabel(view, brief.spot.arrives_day)}` : ''}. You pay only for the units the supplier fills.
      </span>
      <span>On a short day the largest orders are filled first, unless every pulquería votes for equal supply.</span>
    </InfoTip>
  )
}

function FuturesInfo({ view }: { view: PlayerView }): ReactElement {
  const brief = view.brief
  return (
    <InfoTip label="Futures">
      <span>
        Bought at the base price{brief ? ` of ${formatMoney(brief.futures.price)}` : ''} and paid today
        {brief ? `, delivered on ${dayLabel(view, brief.futures.delivery_day)}` : ''}.
      </span>
      <span>On a short day futures are filled first, and units the supplier cannot ship are refunded.</span>
    </InfoTip>
  )
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
      ? `${formatMoney(brief.supplier.spot_price)} · arrives ${dayLabel(view, brief.spot.arrives_day)}`
      : `${formatMoney(brief.futures.price)} · delivered ${dayLabel(view, brief.futures.delivery_day)}`
  }
  const daysLeft = brief?.futures.days_left_to_buy ?? 0
  const shown = open ? value : 0
  return (
    <FormRow
      icon={spot ? ShoppingCart : FileClock}
      label={spot ? 'Buy from Supplier' : 'Futures'}
      info={spot ? <SpotInfo view={view} /> : <FuturesInfo view={view} />}
    >
      <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
        <NumberField
          label={spot ? 'Buy from Supplier' : 'Futures'}
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
        {!spot && open && daysLeft > 0 ? (
          <span className="pt-2">
            <Badge tone={daysLeft === 1 ? 'warning' : 'neutral'} icon={FileClock}>
              {countdown(daysLeft)}
            </Badge>
          </span>
        ) : null}
      </div>
    </FormRow>
  )
}
