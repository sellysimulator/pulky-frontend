import { CalendarDays, CircleCheck, CircleDashed, Flame, FileClock, ShoppingCart, Star, Truck, Users, Wallet } from 'lucide-react'
import type { ReactElement } from 'react'
import type { Brief, Participant, PlayerView, Weekday } from '../../types/game'
import { formatMoney, weekdayShort } from '../../utils/format'
import { InlineAlert } from '../shared/AlertContainer'
import Badge from '../shared/Badge'
import SectionCard from '../shared/SectionCard'
import StatTile from '../shared/StatTile'

const WEEK: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

function WeekdayStrip({ multipliers, today }: { multipliers: Record<Weekday, number>; today: Weekday }): ReactElement {
  const todayIndex = WEEK.indexOf(today)
  return (
    <ul className="grid grid-cols-7 gap-1">
      {WEEK.map((day, index) => {
        const multiplier = multipliers[day]
        const peak = multiplier === 1
        const isToday = day === today
        return (
          <li
            key={day}
            className={[
              'flex flex-col items-center gap-1 rounded-sm px-1 py-1.5 text-center',
              peak ? 'bg-peak' : 'bg-inset',
              isToday ? 'ring-2 ring-ink' : '',
              index < todayIndex ? 'text-ink-subtle' : '',
            ].join(' ')}
          >
            <span className={['flex items-center gap-1 text-xs', isToday ? 'font-bold' : 'font-semibold'].join(' ')}>
              {weekdayShort(day)}
              {peak ? <Flame size={12} aria-hidden="true" className="text-ochre" /> : null}
              {isToday ? <span className="sr-only">today</span> : null}
            </span>
            <span aria-hidden="true" className="flex h-6 w-full items-end">
              <span className="block w-full rounded-xs bg-ochre" style={{ height: `${Math.round(multiplier * 100)}%` }} />
            </span>
          </li>
        )
      })}
    </ul>
  )
}

interface DayStatsProps {
  view: PlayerView
  awaiting: string[]
  participants: Participant[]
}

export default function DayStats({ view, awaiting, participants }: DayStatsProps): ReactElement {
  const brief: Brief | null = view.brief
  const change = view.yesterday?.reputation_change ?? null
  const names = awaiting.map((alias) => participants.find((p) => p.alias === alias)?.display_name ?? alias)
  const waiting = names.length > 0 ? `Waiting for: ${names.join(', ')}` : 'Everyone has submitted.'
  const lastDayToBuy = brief?.futures.days_left_to_buy === 1

  return (
    <SectionCard title="Day stats" icon={CalendarDays}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
          <StatTile
            label="Day"
            icon={CalendarDays}
            value={`${view.day}/${view.duration_days}`}
            sub={
              brief
                ? `${weekdayShort(brief.weekday)} · weekday ×${brief.weekday_multiplier.toFixed(2)}`
                : weekdayShort(view.weekday)
            }
          />
          {brief ? (
            <StatTile
              label="Market demand"
              icon={Users}
              value={`~${Math.round(brief.expected_demand)}`}
              sub={`~${Math.round(view.expected_demand_own)} yours`}
            />
          ) : null}
          {brief ? (
            <StatTile
              label="Spot price"
              icon={ShoppingCart}
              value={formatMoney(brief.supplier.spot_price)}
              sub={`base ${formatMoney(brief.supplier.base_price)}`}
            />
          ) : null}
          <StatTile
            label="Reputation"
            icon={Star}
            value={view.reputation.toFixed(2)}
            delta={
              change === null
                ? undefined
                : {
                    text: `${change >= 0 ? '+' : '−'}${Math.abs(change).toFixed(2)}`,
                    direction: change < 0 ? 'down' : 'up',
                    tone: change > 0 ? 'good' : change < 0 ? 'bad' : 'neutral',
                  }
            }
          />
          <StatTile label="Cash" icon={Wallet} value={formatMoney(view.cash)} />
        </div>

        {brief ? <WeekdayStrip multipliers={brief.weekday_multipliers} today={brief.weekday} /> : null}

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={lastDayToBuy ? 'warning' : 'neutral'} icon={FileClock}>
            {view.order_windows.futures_message}
          </Badge>
          {brief?.transport.shared ? (
            <Badge tone="neutral" icon={Truck}>
              Shared transport
            </Badge>
          ) : null}
        </div>

        {brief?.supplier.disruption_message ? (
          <InlineAlert tone="warning">{brief.supplier.disruption_message}</InlineAlert>
        ) : null}

        <p className="flex items-center gap-2 text-base text-ink-muted">
          {names.length > 0 ? (
            <CircleDashed size={18} aria-hidden="true" className="shrink-0" />
          ) : (
            <CircleCheck size={18} aria-hidden="true" className="shrink-0" />
          )}
          {waiting}
        </p>
      </div>
    </SectionCard>
  )
}
