import type { ReactElement } from 'react'
import { formatMoney, formatPercent } from '../../utils/format'
import DataTable, { type Column } from '../shared/DataTable'
import { PulqueriaChip } from '../shared/Badge'
import SectionCard from '../shared/SectionCard'
import Tooltip from '../shared/Tooltip'
import type { PulqueriaResultView, ResultsView } from './resultsView'

const NULL_REASONS = {
  fill: 'No demand was owed.',
  waste: 'Nothing was sold or spoiled.',
  futures: 'Nothing was shipped.',
}

/** A null ratio is a dash with its reason, never 0 or NaN (spec §8.6 null rules). */
function ratio(value: number | null, reason: string): ReactElement | string {
  if (value !== null) return formatPercent(value)
  return (
    <Tooltip content={reason}>
      <span tabIndex={0} aria-label={`— ${reason}`}>
        —
      </span>
    </Tooltip>
  )
}

/** Block 4 of spec §13.8: one row per pulquería, by rank. */
export default function RatioTable({ view, myAlias = null }: { view: ResultsView; myAlias?: string | null }): ReactElement {
  const hasPeerNet = view.players.length > 0 && view.players.every((p) => typeof p.peer_net === 'number')
  const columns: Column<PulqueriaResultView>[] = [
    {
      key: 'name',
      header: 'Pulquería',
      render: (p) => <PulqueriaChip alias={p.alias} displayName={p.display_name} you={p.alias === myAlias} />,
    },
    { key: 'fill', header: 'Fill rate', align: 'right', render: (p) => ratio(p.fill_rate, NULL_REASONS.fill) },
    { key: 'waste', header: 'Waste rate', align: 'right', render: (p) => ratio(p.waste_rate, NULL_REASONS.waste) },
    { key: 'rep', header: 'Avg reputation', align: 'right', render: (p) => formatPercent(p.avg_reputation) },
    { key: 'share', header: 'Market share', align: 'right', render: (p) => formatPercent(p.overall_market_share) },
    { key: 'futures', header: 'Futures share', align: 'right', render: (p) => ratio(p.futures_share, NULL_REASONS.futures) },
    { key: 'fvs', header: 'Futures vs spot', align: 'right', render: (p) => formatMoney(p.futures_vs_spot) },
    { key: 'ins', header: 'Insurance net', align: 'right', render: (p) => formatMoney(p.insurance_net) },
    ...(hasPeerNet
      ? [
          {
            key: 'peer',
            header: 'Peer net',
            align: 'right' as const,
            render: (p: PulqueriaResultView) => formatMoney(p.peer_net as number),
          },
        ]
      : []),
  ]
  return (
    <SectionCard title="4. Ratios">
      <div className="print:text-sm">
        <DataTable
          caption="Ratios"
          columns={columns}
          rows={view.players}
          rowKey={(p) => p.alias}
          highlightRow={(p) => p.alias === myAlias}
        />
      </div>
    </SectionCard>
  )
}
