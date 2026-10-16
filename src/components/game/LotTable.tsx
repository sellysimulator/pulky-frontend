import { Gauge, Snowflake } from 'lucide-react'
import type { ReactElement } from 'react'
import type { CellarLot } from '../../types/game'
import { formatQty, riskFromQuality } from '../../utils/format'
import Badge from '../shared/Badge'
import RiskIndicator from '../shared/RiskIndicator'

const HEAD = 'px-3 py-2 text-left text-xs font-semibold text-ink-muted'
const CELL = 'px-3 py-2.5 text-base'

/** Spec §13.7: each lot's quality, spoil risk (number, bar and label) and last day, all from `view.cellar`. */
export default function LotTable({ lots }: { lots: CellarLot[] }): ReactElement {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse">
        <caption className="sr-only">Your lots</caption>
        <thead className="bg-inset">
          <tr>
            <th className={HEAD}>Lot</th>
            <th className={`${HEAD} text-right`}>Units</th>
            <th className={`${HEAD} text-right`}>Age</th>
            <th className={HEAD}>
              <span className="inline-flex items-center gap-1">
                <Gauge size={14} aria-hidden="true" />
                Quality
              </span>
            </th>
            <th className={HEAD}>Risk tonight</th>
            <th className={HEAD}>Last day</th>
            <th className={`${HEAD} text-right`}>Expected loss tonight</th>
          </tr>
        </thead>
        <tbody>
          {lots.map((lot) => (
            <tr key={lot.id} className="border-t border-border hover:bg-inset">
              <td className={CELL}>
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{lot.id}</span>
                  {lot.conserved ? (
                    <Badge tone="info" icon={Snowflake}>
                      Conserved
                    </Badge>
                  ) : null}
                </span>
              </td>
              <td className={`${CELL} text-right tabular-nums`}>{formatQty(lot.qty)}</td>
              <td className={`${CELL} text-right tabular-nums`}>{lot.age}</td>
              <td className={`${CELL} tabular-nums`}>{`${lot.quality}%`}</td>
              <td className={CELL}>
                <RiskIndicator risk={riskFromQuality(lot.quality)} />
              </td>
              <td className={`${CELL} tabular-nums`}>{`Day ${lot.last_day}`}</td>
              <td className={`${CELL} text-right tabular-nums`}>
                {lot.expected_loss_tonight.toLocaleString('en-US', { maximumFractionDigits: 1 })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
