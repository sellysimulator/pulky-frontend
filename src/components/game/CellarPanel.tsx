import { Warehouse } from 'lucide-react'
import type { ReactElement } from 'react'
import type { PlayerView } from '../../types/game'
import { formatQty } from '../../utils/format'
import EmptyState from '../shared/EmptyState'
import SectionCard from '../shared/SectionCard'
import FuturesBook from './FuturesBook'
import InTransit from './InTransit'
import LotTable from './LotTable'
import StockByAgeChart from './StockByAgeChart'

export default function CellarPanel({ view }: { view: PlayerView }): ReactElement {
  const units = view.cellar.reduce((sum, lot) => sum + lot.qty, 0)
  const meta = `${formatQty(units)} units · backlog ${formatQty(view.backlog)} · expected demand ~${Math.round(view.expected_demand_own)}`
  return (
    <SectionCard title="Your cellar" icon={Warehouse} meta={meta}>
      <div className="flex flex-col gap-4">
        {view.cellar.length === 0 ? (
          <EmptyState icon={Warehouse} title="The cellar is empty" body="Stock arrives with your next delivery." />
        ) : (
          <LotTable lots={view.cellar} />
        )}
        {view.stock_by_age.length > 0 ? <StockByAgeChart rows={view.stock_by_age} /> : null}
        <InTransit shipments={view.in_transit} plans={view.tier_plans} />
        <FuturesBook contracts={view.futures_book} />
      </div>
    </SectionCard>
  )
}
