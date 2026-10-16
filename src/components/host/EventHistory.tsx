import { ArrowLeftRight, Handshake, ThermometerSun, Unplug, type LucideIcon } from 'lucide-react'
import type { ReactElement } from 'react'
import type { HostView, Weekday } from '../../types/game'
import { formatMoney, formatQty, weekdayShort } from '../../utils/format'
import SectionCard from '../shared/SectionCard'
import type { HostHistories } from './presentationData'

interface EventHistoryProps {
  hostView: HostView
  histories: HostHistories
}

interface HostEvent {
  key: string
  day: number
  rank: number
  seller: number
  order: number
  icon: LucideIcon
  text: string
}

const MARKET_RANK = { disrupted: 0, failure: 1, cooperation: 2, trade: 3 } as const

function aliasNumber(alias: string): number {
  return Number(/^P(\d+)$/.exec(alias)?.[1] ?? Number.MAX_SAFE_INTEGER)
}

function buildEvents(hostView: HostView, histories: HostHistories): HostEvent[] {
  const weekdays = new Map<number, Weekday>()
  const events: HostEvent[] = []

  for (const row of histories.marketHistory) {
    weekdays.set(row.day, row.weekday)
    const label = `Day ${row.day} (${weekdayShort(row.weekday)})`
    const market: Array<[boolean, keyof typeof MARKET_RANK, LucideIcon, string]> = [
      [row.disrupted, 'disrupted', Unplug, 'supplier disrupted'],
      [row.refrigeration_failure, 'failure', ThermometerSun, 'refrigeration failure'],
      [row.cooperation, 'cooperation', Handshake, 'everyone cooperated'],
    ]
    for (const [happened, kind, icon, words] of market) {
      if (!happened) continue
      events.push({ key: `${kind}-${row.day}`, day: row.day, rank: MARKET_RANK[kind], seller: 0, order: 0, icon, text: `${label}: ${words}` })
    }
  }

  for (const [alias, records] of Object.entries(histories.players)) {
    for (const record of records) {
      record.peer_trades.forEach((trade, index) => {
        if (trade.side !== 'sell') return
        const weekday = weekdays.get(record.day) ?? record.weekday
        const seller = hostView.players[alias]?.display_name ?? alias
        const buyer = hostView.players[trade.counterparty]?.display_name ?? trade.counterparty
        events.push({
          key: `trade-${record.day}-${alias}-${trade.lot_id}-${index}`,
          day: record.day,
          rank: MARKET_RANK.trade,
          seller: aliasNumber(alias),
          order: index,
          icon: ArrowLeftRight,
          text: `Day ${record.day} (${weekdayShort(weekday)}): ${seller} sold ${formatQty(trade.qty)} to ${buyer} at ${formatMoney(trade.price)} (${trade.quality}%)`,
        })
      })
    }
  }

  return events.sort((a, b) => b.day - a.day || a.rank - b.rank || a.seller - b.seller || a.order - b.order)
}

/** Newest day first; within a day the market events, then each peer trade once, from the seller's record (spec §11.4). */
export default function EventHistory({ hostView, histories }: EventHistoryProps): ReactElement {
  const events = buildEvents(hostView, histories)
  return (
    <SectionCard title="Events" density="dense">
      {events.length === 0 ? (
        <p className="text-sm text-ink-muted">No events yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((event) => {
            const Icon = event.icon
            return (
              <li key={event.key} className="flex items-center gap-2 text-sm">
                <Icon size={16} aria-hidden="true" className="shrink-0 text-ink-muted" />
                <span>{event.text}</span>
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}
