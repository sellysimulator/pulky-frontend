import {
  ArrowLeftRight,
  ClockAlert,
  Factory,
  FileClock,
  ShieldCheck,
  ThermometerSun,
  Trash,
  type LucideIcon,
} from 'lucide-react'
import type { ReactElement } from 'react'
import type { DayRecord, Participant, PlayerView, PublicDayResults } from '../../types/game'
import { formatMoney, formatPercent, formatQty } from '../../utils/format'
import DataTable, { type Column } from '../shared/DataTable'

interface LedgerLine {
  label: string
  amount: number
}

/** Spec §8.1 order, every line shown, costs as negative values. */
function ledgerLines(r: DayRecord): LedgerLine[] {
  return [
    { label: 'Sales', amount: r.revenue_sales },
    { label: 'Salvage', amount: r.revenue_salvage },
    { label: 'Peer sales', amount: r.revenue_peer },
    { label: 'Insurance refunds', amount: r.refund_insurance },
    { label: 'Futures refunds', amount: r.refund_futures },
    { label: 'Spot purchases', amount: -r.cost_spot },
    { label: 'Futures bought', amount: -r.cost_futures },
    { label: 'Peer purchases', amount: -r.cost_peer },
    { label: 'Transport', amount: -r.cost_transport },
    { label: 'Insurance fees', amount: -r.cost_insurance },
    { label: 'Conservation', amount: -r.cost_conservation },
    { label: 'Holding cost', amount: -r.cost_holding },
    { label: 'Backlog penalty', amount: -r.cost_backlog },
    { label: 'Profit', amount: r.profit },
    { label: 'Cash at day end', amount: r.cash_end },
  ]
}

const LEDGER_COLUMNS: Column<LedgerLine>[] = [
  { key: 'line', header: 'Line', render: (l) => l.label },
  { key: 'amount', header: 'Amount', align: 'right', render: (l) => formatMoney(l.amount) },
]

export function LedgerTable({ record }: { record: DayRecord }): ReactElement {
  return <DataTable caption="Ledger" columns={LEDGER_COLUMNS} rows={ledgerLines(record)} rowKey={(l) => l.label} density="compact" />
}

interface DayRecapProps {
  record: DayRecord
  view: PlayerView
  publicHistory: PublicDayResults[]
  participants: Participant[]
}

interface EventLine {
  key: string
  icon: LucideIcon
  tone?: 'bad' | 'warn'
  text: string
  trades?: string[]
}

const TONES = { bad: 'text-danger-ink', warn: 'text-warning-ink' }

/** The events of the day, in spec §13.7's order, each only when its condition holds. */
function eventsOf(r: DayRecord, view: PlayerView, publicHistory: PublicDayResults[], participants: Participant[]): EventLine[] {
  const nameOf = (alias: string): string => participants.find((p) => p.alias === alias)?.display_name ?? alias
  const tradeLine = (t: DayRecord['peer_trades'][number]): string => {
    const direction = t.side === 'buy' ? 'from' : 'to'
    return `${t.qty} ${direction} ${nameOf(t.counterparty)} at ${formatMoney(t.price)} (${t.quality}%)`
  }
  const events: EventLine[] = []

  if (r.futures_filled > 0) {
    const base = view.brief?.supplier.base_price ?? 0
    const spot = publicHistory.find((p) => p.day === r.day)?.spot_price ?? base + r.futures_vs_spot / r.futures_filled
    const outcome =
      r.futures_vs_spot < 0
        ? `they cost ${formatMoney(-r.futures_vs_spot)} more`
        : `you saved ${formatMoney(r.futures_vs_spot)}`
    events.push({
      key: 'futures',
      icon: FileClock,
      text: `Futures shipped ${formatQty(r.futures_filled)} units at ${formatMoney(base)} — spot was ${formatMoney(spot)}, ${outcome}.`,
    })
  }
  if (r.futures_unfilled > 0) {
    const filled = r.futures_due > 0 ? formatPercent(r.futures_filled / r.futures_due) : formatPercent(0)
    events.push({
      key: 'futures-short',
      icon: FileClock,
      text: `The supplier was short: your futures filled ${filled}; ${formatQty(r.futures_unfilled)} units cancelled and refunded (${formatMoney(r.refund_futures)}).`,
    })
  }
  if (r.lost_transport > 0) {
    const how = view.brief?.transport.shared ? 'sharing the truck' : 'shipping alone'
    events.push({
      key: 'refrigeration',
      icon: ThermometerSun,
      tone: 'bad',
      text: `Refrigeration failed: you lost ${formatQty(r.lost_transport)} units (${how}).`,
    })
  }
  if (r.refund_insurance > 0) {
    events.push({
      key: 'insurance',
      icon: ShieldCheck,
      text: `Insurance refund for units lost in transit: ${formatMoney(r.refund_insurance)}.`,
    })
  }
  if (r.spoiled > 0) {
    const salvage = r.revenue_salvage === 0 ? '.' : ` → salvaged for ${formatMoney(r.revenue_salvage)}.`
    events.push({
      key: 'spoiled',
      icon: Trash,
      tone: 'warn',
      text: `${formatQty(r.spoiled)} units spoiled overnight${salvage}`,
    })
  }
  if (r.backlog_end > 0) {
    events.push({
      key: 'backlog',
      icon: ClockAlert,
      tone: 'bad',
      text: `${formatQty(r.backlog_end)} units of demand went into backlog (−${formatMoney(r.cost_backlog)} penalty; reputation ▼).`,
    })
  }
  if (r.shortfall_spot > 0) {
    events.push({
      key: 'short',
      icon: Factory,
      text: `The supplier was short: ${formatQty(r.shortfall_spot)} of your ${formatQty(r.order_spot)} spot units were not allocated.`,
    })
    if (r.peer_buy !== null) {
      if (r.peer_bought >= r.shortfall_spot) {
        events.push({
          key: 'bought-all',
          icon: ArrowLeftRight,
          text: `You bought all ${formatQty(r.peer_bought)} from other pulquerías for ${formatMoney(r.cost_peer)}.`,
          trades: r.peer_trades.filter((t) => t.side === 'buy').map(tradeLine),
        })
      } else if (r.peer_bought > 0) {
        events.push({
          key: 'bought-part',
          icon: ArrowLeftRight,
          text: `You bought ${formatQty(r.peer_bought)} from other pulquerías for ${formatMoney(r.cost_peer)}; ${formatQty(r.shortfall_spot - r.peer_bought)} found no offer within your price, quality and cash.`,
          trades: r.peer_trades.filter((t) => t.side === 'buy').map(tradeLine),
        })
      } else {
        events.push({
          key: 'bought-none',
          icon: ArrowLeftRight,
          text: 'No pulquería offered units within your price, quality and cash.',
        })
      }
    }
  }
  if (r.peer_sold > 0) {
    events.push({
      key: 'sold',
      icon: ArrowLeftRight,
      text: `You sold ${formatQty(r.peer_sold)} units to other pulquerías for ${formatMoney(r.revenue_peer)}.`,
      trades: r.peer_trades.filter((t) => t.side === 'sell').map(tradeLine),
    })
  }
  return events
}

export default function DayRecap({ record, view, publicHistory, participants }: DayRecapProps): ReactElement {
  const events = eventsOf(record, view, publicHistory, participants)
  return (
    <div className="flex flex-col gap-4">
      {events.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {events.map((e) => {
            const Icon = e.icon
            return (
              <li key={e.key} className="flex items-start gap-2">
                <Icon size={18} aria-hidden="true" className={['mt-0.5 shrink-0', e.tone ? TONES[e.tone] : 'text-ink-muted'].join(' ')} />
                <div className="min-w-0">
                  <span className={e.tone ? TONES[e.tone] : ''}>{e.text}</span>
                  {e.trades && e.trades.length > 0 ? (
                    <ul className="mt-1 flex flex-col gap-0.5 text-sm text-ink-muted">
                      {e.trades.map((line, i) => (
                        <li key={`${line}-${i}`}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
      <LedgerTable record={record} />
    </div>
  )
}
