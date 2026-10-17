import { ArrowLeftRight, CircleCheck, CircleDashed, Factory, FileClock, Flame, ShoppingCart, Users } from 'lucide-react'
import { useEffect, type ReactElement } from 'react'
import { slotIndex, SLOT_BG } from '../../styles/slots'
import { formatMoney, formatPercent, formatQty, weekdayLong } from '../../utils/format'
import { InlineAlert } from '../shared/AlertContainer'
import Badge from '../shared/Badge'
import Button from '../shared/Button'
import DataTable, { type Column } from '../shared/DataTable'
import StatTile from '../shared/StatTile'
import type { PresentationData } from './presentationData'

interface PresentationModeProps {
  data: PresentationData
  onExit(): void
}

interface ResultRow {
  alias: string
  displayName: string
  unitsSold: number
  marketShare: number
  reputation: number
}

function aliasNumber(alias: string): number {
  return Number(/^P(\d+)$/.exec(alias)?.[1] ?? Number.MAX_SAFE_INTEGER)
}

/** Short projector labels, deliberately shorter than the spec §4.2 window copy. */
function futuresLabel(daysLeft: number): string {
  if (daysLeft > 1) return `${daysLeft} days left to buy`
  if (daysLeft === 1) return 'Last day to buy futures'
  return 'Futures closed'
}

/** Public data only (spec §11.1, §11.4): it renders what the selector copied and reads no store. */
export default function PresentationMode({ data, onExit }: PresentationModeProps): ReactElement {
  useEffect(() => {
    document.documentElement.dataset.scale = 'presentation'
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onExit()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      delete document.documentElement.dataset.scale
    }
  }, [onExit])

  const { brief, latest } = data
  const rows: ResultRow[] =
    latest === null
      ? []
      : Object.keys(latest.players)
          .sort((a, b) => aliasNumber(a) - aliasNumber(b))
          .map((alias) => ({
            alias,
            displayName: latest.players[alias].display_name,
            unitsSold: latest.players[alias].units_sold,
            marketShare: latest.players[alias].market_share,
            reputation: latest.players[alias].reputation,
          }))
  const columns: Column<ResultRow>[] = [
    { key: 'name', header: 'Pulquería', render: (r) => r.displayName },
    { key: 'sold', header: 'Sold', align: 'right', render: (r) => formatQty(r.unitsSold) },
    {
      key: 'share',
      header: 'Share',
      render: (r) => (
        <span className="flex items-center gap-3">
          <span aria-hidden="true" className="h-3 w-24 shrink-0 rounded-xs bg-muted">
            <span
              className={['block h-3 rounded-xs', SLOT_BG[slotIndex(r.alias)]].join(' ')}
              style={{ width: `${Math.min(100, Math.max(0, r.marketShare * 100))}%` }}
            />
          </span>
          <span className="tabular-nums">{formatPercent(r.marketShare)}</span>
        </span>
      ),
    },
    { key: 'reputation', header: 'Reputation', align: 'right', render: (r) => r.reputation.toFixed(2) },
  ]

  return (
    <div className="fixed inset-0 z-40 flex flex-col gap-8 overflow-auto bg-card px-10 py-8 text-ink">
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="text-figure">{`Day ${data.day} · ${weekdayLong(data.weekday)}`}</h1>
        {data.isPeak ? (
          <Badge tone="warning" icon={Flame}>
            Peak day
          </Badge>
        ) : null}
        <div className="ml-auto">
          <Button variant="secondary" size="lg" onClick={onExit}>
            Exit
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
        <StatTile label="Expected demand" icon={Users} value={`~${formatQty(brief.expected_demand)}`} />
        <StatTile label="Spot price" icon={ShoppingCart} value={formatMoney(brief.supplier.spot_price)} />
        <StatTile
          label="Supplier capacity"
          icon={Factory}
          value={formatQty(brief.supplier.capacity)}
          sub={
            brief.supplier.disruption_message !== null ? (
              <span className="font-semibold text-warning-ink">{brief.supplier.disruption_message}</span>
            ) : undefined
          }
        />
        <StatTile label="Futures" icon={FileClock} value={futuresLabel(brief.futures.days_left_to_buy)} />
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section aria-labelledby="presentation-yesterday" className="flex flex-col gap-4">
          <h2 id="presentation-yesterday" className="text-xl">
            Yesterday
          </h2>
          {latest === null ? (
            <p className="text-xl text-ink-muted">No results yet.</p>
          ) : (
            <>
              <DataTable caption="Yesterday" columns={columns} rows={rows} rowKey={(r) => r.alias} />
              {data.peerMarket ? (
                <p className="flex items-center gap-2 text-lg text-ink-muted">
                  <ArrowLeftRight size={24} aria-hidden="true" />
                  <span>
                    {latest.peer_units === 0 || latest.peer_avg_price === null
                      ? 'Peer market: no trades'
                      : `Peer market: ${formatQty(latest.peer_units)} units at ${formatMoney(latest.peer_avg_price)} on average`}
                  </span>
                </p>
              ) : null}
            </>
          )}
        </section>

        <section aria-labelledby="presentation-submissions" className="flex flex-col gap-4">
          <h2 id="presentation-submissions" className="text-xl">
            Submissions
          </h2>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {data.submitted.map((p) => (
              <li
                key={p.alias}
                className={[
                  'flex items-center gap-2 rounded-sm px-3 py-2 text-lg font-medium',
                  p.submitted ? 'bg-success-subtle text-success-ink' : 'bg-muted text-ink-muted',
                ].join(' ')}
              >
                {p.submitted ? <CircleCheck size={24} aria-hidden="true" /> : <CircleDashed size={24} aria-hidden="true" />}
                <span>{`${p.displayName} ${p.submitted ? 'submitted' : 'deciding'}`}</span>
              </li>
            ))}
          </ul>
          {latest?.refrigeration_failure ? <InlineAlert tone="danger">Refrigeration failed yesterday.</InlineAlert> : null}
          {latest?.cooperation ? <InlineAlert tone="info">Everyone cooperated yesterday.</InlineAlert> : null}
        </section>
      </div>
    </div>
  )
}
