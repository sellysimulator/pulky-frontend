import type { ReactElement } from 'react'
import type { InTransit as Shipment } from '../../types/game'
import { formatQty } from '../../utils/format'
import DataTable, { type Column } from '../shared/DataTable'

const COLUMNS: Column<Shipment>[] = [
  { key: 'shipped', header: 'Shipped', render: (s) => `Day ${s.shipped_day}` },
  { key: 'arrives', header: 'Arrives', render: (s) => `Day ${s.arrives_day}` },
  { key: 'units', header: 'Units', align: 'right', render: (s) => formatQty(s.qty) },
  { key: 'lost', header: 'Lost', align: 'right', render: (s) => formatQty(s.lost) },
  { key: 'tier', header: 'Tier', render: (s) => s.incoterm.toUpperCase() },
]

export default function InTransit({ shipments }: { shipments: Shipment[] }): ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">In transit</h3>
      {shipments.length === 0 ? (
        <p className="text-sm text-ink-muted">Nothing in transit.</p>
      ) : (
        <DataTable
          caption="In transit"
          columns={COLUMNS}
          rows={shipments}
          rowKey={(s) => `${s.shipped_day}-${s.arrives_day}-${s.incoterm}-${s.qty}`}
          density="compact"
        />
      )}
    </div>
  )
}
