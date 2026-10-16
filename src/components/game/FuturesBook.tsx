import type { ReactElement } from 'react'
import type { FuturesContract } from '../../types/game'
import { formatQty } from '../../utils/format'
import DataTable, { type Column } from '../shared/DataTable'

const COLUMNS: Column<FuturesContract>[] = [
  { key: 'bought', header: 'Bought', render: (c) => `Day ${c.contract_day}` },
  { key: 'ships', header: 'Ships', render: (c) => `Day ${c.ships_day}` },
  { key: 'delivered', header: 'Delivered', render: (c) => `Day ${c.delivery_day}` },
  { key: 'units', header: 'Units', align: 'right', render: (c) => formatQty(c.qty) },
]

export default function FuturesBook({ contracts }: { contracts: FuturesContract[] }): ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Futures book</h3>
      {contracts.length === 0 ? (
        <p className="text-sm text-ink-muted">No open futures.</p>
      ) : (
        <DataTable
          caption="Futures book"
          columns={COLUMNS}
          rows={contracts}
          rowKey={(c) => `${c.contract_day}-${c.ships_day}-${c.qty}`}
          density="compact"
        />
      )}
    </div>
  )
}
