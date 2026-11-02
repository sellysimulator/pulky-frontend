import { useState, type ReactElement } from 'react'
import { Line } from 'react-chartjs-2'
import { formatQty, weekdayShort } from '../../utils/format'
import { MEASURE_STYLES } from '../charts/chartSetup'
import ChartBox from '../shared/ChartBox'
import DataTable, { type Column } from '../shared/DataTable'
import Legend from '../shared/Legend'
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
    <Legend
      items={DEMAND_SUPPLY_LEGEND_ORDER.map((s) => ({
        key: s,
        label: DEMAND_SUPPLY_LABELS[s],
        swatch: { kind: 'line' as const, color: MEASURE_STYLES[s].color, dash: MEASURE_STYLES[s].dash, width: MEASURE_STYLES[s].width },
      }))}
      hidden={new Set(DEMAND_SUPPLY_LEGEND_ORDER.filter((s) => !visible.includes(s)))}
      onToggle={(key) => toggle(key as DemandSupplySeries)}
    />
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
