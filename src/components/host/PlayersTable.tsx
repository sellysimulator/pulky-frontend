import { ClockAlert, ThermometerSun, Wifi, WifiOff } from 'lucide-react'
import type { ReactElement } from 'react'
import type { HostPlayerRow, HostView } from '../../types/game'
import { formatMoney, formatPercent, formatQty } from '../../utils/format'
import { PulqueriaChip } from '../shared/Badge'
import DataTable, { type Column } from '../shared/DataTable'
import type { HostHistories } from './presentationData'

interface PlayersTableProps {
  hostView: HostView
  histories: HostHistories
}

interface Row {
  alias: string
  player: HostPlayerRow
  refrigerationFailure: boolean
}

const DASH = '—'

function aliasNumber(alias: string): number {
  return Number(/^P(\d+)$/.exec(alias)?.[1] ?? Number.MAX_SAFE_INTEGER)
}

function orDash(value: number | null): string {
  return value === null ? DASH : formatQty(value)
}

/** Spec §11.4 columns, grouped; every value is the server's, none is computed here. */
export default function PlayersTable({ hostView, histories }: PlayersTableProps): ReactElement {
  const peerMarket = hostView.config.peer_market.enabled
  const rows: Row[] = Object.keys(hostView.players)
    .sort((a, b) => aliasNumber(a) - aliasNumber(b))
    .map((alias) => {
      const records = histories.players[alias] ?? []
      const last = records.length > 0 ? records[records.length - 1] : null
      return { alias, player: hostView.players[alias], refrigerationFailure: last !== null && last.lost_transport > 0 }
    })

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Pulquería',
      render: (r) => (
        <span className="inline-flex items-center gap-2">
          <PulqueriaChip alias={r.alias} displayName={r.player.display_name} />
          {r.refrigerationFailure ? (
            <>
              <ThermometerSun size={16} aria-hidden="true" className="text-danger-ink" />
              <span className="sr-only">refrigeration failure yesterday</span>
            </>
          ) : null}
        </span>
      ),
    },
    {
      key: 'connected',
      header: 'Connected',
      render: (r) => (
        <span className="inline-flex items-center gap-1">
          {r.player.connected ? <Wifi size={16} aria-hidden="true" /> : <WifiOff size={16} aria-hidden="true" />}
          {r.player.connected ? 'yes' : 'no'}
        </span>
      ),
    },
    { key: 'submitted', header: 'Submitted', render: (r) => (r.player.has_submitted ? 'yes' : 'no') },
    { key: 'stock', header: 'On hand', align: 'right', render: (r) => formatQty(r.player.stock_units) },
    { key: 'spoil', header: 'Spoiling tonight', align: 'right', render: (r) => r.player.expected_spoil_tonight.toFixed(1) },
    { key: 'transit', header: 'In transit', align: 'right', render: (r) => formatQty(r.player.in_transit_units) },
    { key: 'futures', header: 'Open futures', align: 'right', render: (r) => formatQty(r.player.open_futures_units) },
    {
      key: 'backlog',
      header: 'Backlog',
      align: 'right',
      render: (r) => (
        <span className="inline-flex items-center justify-end gap-1">
          {r.player.backlog > 0 ? <ClockAlert size={16} aria-hidden="true" className="text-warning-ink" /> : null}
          {formatQty(r.player.backlog)}
        </span>
      ),
    },
    { key: 'reputation', header: 'Reputation', align: 'right', render: (r) => r.player.reputation.toFixed(2) },
    { key: 'share', header: 'Share', align: 'right', render: (r) => formatPercent(r.player.market_share) },
  ]
  if (peerMarket) {
    columns.push(
      { key: 'bought', header: 'Bought', align: 'right', render: (r) => orDash(r.player.last_peer_bought) },
      { key: 'sold', header: 'Sold', align: 'right', render: (r) => orDash(r.player.last_peer_sold) },
    )
  }
  columns.push(
    { key: 'profit', header: 'Profit', align: 'right', render: (r) => formatMoney(r.player.cumulative_profit) },
    { key: 'cash', header: 'Cash', align: 'right', render: (r) => formatMoney(r.player.cash) },
    { key: 'waste', header: 'Waste rate', align: 'right', render: (r) => formatPercent(r.player.waste_rate) },
    { key: 'fill', header: 'Fill rate', align: 'right', render: (r) => formatPercent(r.player.fill_rate) },
    { key: 'tier', header: 'Last tier', render: (r) => (r.player.last_incoterm === null ? DASH : r.player.last_incoterm.toUpperCase()) },
  )

  const groups = [
    { label: '', span: 3 },
    { label: 'Stock', span: 4 },
    { label: 'Market', span: 3 },
    ...(peerMarket ? [{ label: 'Peer market', span: 2 }] : []),
    { label: 'Money', span: 2 },
    { label: 'Rates', span: 3 },
  ]

  return (
    <DataTable
      caption="Pulquerías"
      captionVisible
      columns={columns}
      rows={rows}
      rowKey={(r) => r.alias}
      density="compact"
      stickyFirstColumn
      groups={groups}
    />
  )
}
