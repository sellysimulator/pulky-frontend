import type { ReactElement } from 'react'
import type { IncotermTierPlan, InTransit as Shipment } from '../../types/game'
import { INCOTERM_TIER_NAMES, formatQty } from '../../utils/format'
import DataTable, { type Column } from '../shared/DataTable'
import TierDetails from './TierDetails'

function columns(plans: IncotermTierPlan[]): Column<Shipment>[] {
  return [
    { key: 'shipped', header: 'Shipped', render: (s) => `Day ${s.shipped_day}` },
    { key: 'arrives', header: 'Arrives', render: (s) => `Day ${s.arrives_day}` },
    { key: 'units', header: 'Units', align: 'right', render: (s) => formatQty(s.qty) },
    { key: 'lost', header: 'Lost', align: 'right', render: (s) => formatQty(s.lost) },
    {
      key: 'tier',
      header: 'Tier',
      render: (s) => {
        const plan = plans.find((p) => p.tier === s.incoterm_tier)
        return (
          <span className="inline-flex items-center gap-1">
            {INCOTERM_TIER_NAMES[s.incoterm_tier]}
            {plan ? <TierDetails plan={plan} /> : null}
          </span>
        )
      },
    },
  ]
}

export default function InTransit({ shipments, plans }: { shipments: Shipment[]; plans: IncotermTierPlan[] }): ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">In transit</h3>
      {shipments.length === 0 ? (
        <p className="text-sm text-ink-muted">Nothing in transit.</p>
      ) : (
        <DataTable
          caption="In transit"
          columns={columns(plans)}
          rows={shipments}
          rowKey={(s) => `${s.shipped_day}-${s.arrives_day}-${s.incoterm_tier}-${s.qty}`}
          density="compact"
        />
      )}
    </div>
  )
}
