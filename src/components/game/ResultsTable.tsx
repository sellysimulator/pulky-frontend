import type { ReactElement } from 'react'
import type { PublicDayResults } from '../../types/game'
import { formatPercent, formatQty } from '../../utils/format'
import { PulqueriaChip } from '../shared/Badge'
import DataTable, { type Column } from '../shared/DataTable'

export interface ResultsRow {
  alias: string
  display_name: string
  units_sold: number
  market_share: number
  reputation: number
}

const aliasNumber = (alias: string): number => Number(/^P(\d+)$/.exec(alias)?.[1] ?? Number.MAX_SAFE_INTEGER)

/** The public players of one day, in alias order. */
// eslint-disable-next-line react-refresh/only-export-components
export function resultsRows(day: PublicDayResults): ResultsRow[] {
  return Object.entries(day.players)
    .map(([alias, p]) => ({ alias, ...p }))
    .sort((a, b) => aliasNumber(a.alias) - aliasNumber(b.alias))
}

export default function ResultsTable({ day, ownAlias }: { day: PublicDayResults; ownAlias: string }): ReactElement {
  const columns: Column<ResultsRow>[] = [
    {
      key: 'name',
      header: 'Pulquería',
      render: (r) => <PulqueriaChip alias={r.alias} displayName={r.display_name} you={r.alias === ownAlias} />,
    },
    { key: 'sold', header: 'Sold', align: 'right', render: (r) => formatQty(r.units_sold) },
    { key: 'share', header: 'Share', align: 'right', render: (r) => formatPercent(r.market_share) },
    { key: 'reputation', header: 'Reputation', align: 'right', render: (r) => r.reputation.toFixed(2) },
  ]
  return (
    <DataTable
      caption="Yesterday's market"
      columns={columns}
      rows={resultsRows(day)}
      rowKey={(r) => r.alias}
      highlightRow={(r) => r.alias === ownAlias}
    />
  )
}
