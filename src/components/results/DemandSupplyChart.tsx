import { Check } from 'lucide-react'
import { useState, type ReactElement } from 'react'
import { Line } from 'react-chartjs-2'
import { formatQty, weekdayShort } from '../../utils/format'
import { MEASURE_STYLES } from '../charts/chartSetup'
import ChartBox from '../shared/ChartBox'
import DataTable, { type Column } from '../shared/DataTable'
import SectionCard from '../shared/SectionCard'
import {
  DEMAND_SUPPLY_LABELS,
  DEMAND_SUPPLY_LEGEND_ORDER,
  buildDemandSupplyConfig,
  type DemandSupplySeries,
} from './demandSupplyConfig'
import type { ResultsView } from './resultsView'

interface DayRow {
  day: number
  weekday: string
  values: Record<DemandSupplySeries, number>
}

function rowsFor(view: ResultsView): DayRow[] {
  const m = view.market
  return Array.from({ length: view.days_played }, (_, i) => ({
    day: i + 1,
    weekday: weekdayShort(m.weekday[i]),
    values: {
      demand: m.demand[i],
      delivered: m.delivered[i],
      sold: m.sold[i],
      spoiled: m.spoiled[i],
      backlog: m.backlog_end[i],
    },
  }))
}

function LineSwatch({ series }: { series: DemandSupplySeries }): ReactElement {
  const style = MEASURE_STYLES[series]
  return (
    <svg width="24" height="12" viewBox="0 0 24 12" aria-hidden="true" className="shrink-0">
      <line
        x1="0"
        y1="6"
        x2="24"
        y2="6"
        stroke={style.color}
        strokeWidth={style.width}
        strokeLinecap="round"
        strokeDasharray={style.dash.length > 0 ? style.dash.join(' ') : undefined}
      />
    </svg>
  )
}

/** Block 2 of spec §13.8, THE CHART: demand against what arrived, sold and spoiled, with a switch legend. */
export default function DemandSupplyChart({ view }: { view: ResultsView }): ReactElement {
  const [visible, setVisible] = useState<DemandSupplySeries[]>(DEMAND_SUPPLY_LEGEND_ORDER)
  const shown = DEMAND_SUPPLY_LEGEND_ORDER.filter((s) => visible.includes(s))
  const config = buildDemandSupplyConfig(view, shown)
  const rows = rowsFor(view)

  const toggle = (series: DemandSupplySeries): void =>
    setVisible((current) => (current.includes(series) ? current.filter((s) => s !== series) : [...current, series]))

  const columns: Column<DayRow>[] = [
    { key: 'day', header: 'Day', render: (r) => r.day },
    { key: 'weekday', header: 'Weekday', render: (r) => r.weekday },
    ...shown.map(
      (s): Column<DayRow> => ({
        key: s,
        header: DEMAND_SUPPLY_LABELS[s],
        align: 'right',
        render: (r) => formatQty(r.values[s]),
      }),
    ),
  ]

  const legend = (
    <div className="flex flex-wrap gap-x-4 gap-y-2 print:hidden">
      {DEMAND_SUPPLY_LEGEND_ORDER.map((s) => {
        const on = visible.includes(s)
        return (
          <button
            key={s}
            type="button"
            role="switch"
            aria-checked={on}
            onClick={() => toggle(s)}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-sm border border-border-control px-3 text-sm"
          >
            <span
              aria-hidden="true"
              className={[
                'grid size-4 shrink-0 place-items-center rounded-xs border border-border-control',
                on ? 'bg-accent text-on-accent' : 'bg-card',
              ].join(' ')}
            >
              {on ? <Check size={12} /> : null}
            </span>
            <span className={on ? '' : 'opacity-30'}>
              <LineSwatch series={s} />
            </span>
            <span className={on ? 'text-ink' : 'text-ink-subtle'}>{DEMAND_SUPPLY_LABELS[s]}</span>
          </button>
        )
      })}
    </div>
  )

  return (
    <SectionCard title="2. Demand vs supply">
      <div>
        <ChartBox
          title="Market demand vs pulque delivered, sold and spoiled"
          ariaLabel="Line chart of market demand, pulque delivered, units sold, units spoiled and backlog at day end, for each day played"
          height={448}
          legend={legend}
          table={
            <DataTable caption="Demand and supply per day" columns={columns} rows={rows} rowKey={(r) => String(r.day)} density="compact" />
          }
        >
          <Line data={config.data} options={config.options} />
        </ChartBox>
      </div>
      <div className="sr-only">
        <DataTable caption="Plotted values" columns={columns} rows={rows} rowKey={(r) => String(r.day)} density="compact" />
      </div>
    </SectionCard>
  )
}
