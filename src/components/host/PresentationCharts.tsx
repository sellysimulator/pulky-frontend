import { ChartLine } from 'lucide-react'
import type { ReactElement } from 'react'
import { Bar, Line } from 'react-chartjs-2'
import { formatPercent, formatQty } from '../../utils/format'
import { MEASURE_STYLES, pulqueriaStyle } from '../charts/chartSetup'
import ChartBox from '../shared/ChartBox'
import DataTable, { type Column } from '../shared/DataTable'
import EmptyState from '../shared/EmptyState'
import Legend from '../shared/Legend'
import { buildDemandSoldConfig, buildShareByDayConfig } from './projectorChartsConfig'
import type { PresentationDay } from './presentationData'

const CHART_HEIGHT = 360

interface Row {
  index: number
  day: number
}

function aliasNumber(alias: string): number {
  return Number(/^P(\d+)$/.exec(alias)?.[1] ?? Number.MAX_SAFE_INTEGER)
}

/** The two projector charts, drawn from the public day results only. */
export default function PresentationCharts({ history }: { history: PresentationDay[] }): ReactElement {
  if (history.length === 0) {
    return <EmptyState icon={ChartLine} title="No days closed yet" body="Charts fill in as days close." />
  }
  const rows: Row[] = history.map((entry, index) => ({ index, day: entry.day }))
  const share = buildShareByDayConfig(history)
  const demandSold = buildDemandSoldConfig(history)
  const aliases = [...new Set(history.flatMap((entry) => Object.keys(entry.shares)))].sort(
    (a, b) => aliasNumber(a) - aliasNumber(b),
  )

  const shareColumns: Column<Row>[] = [
    { key: 'day', header: 'Day', render: (r) => r.day },
    ...aliases.map(
      (alias, i): Column<Row> => ({
        key: alias,
        header: String(share.data.datasets[i].label),
        align: 'right',
        render: (r) => {
          const value = share.data.datasets[i].data[r.index]
          return typeof value === 'number' ? formatPercent(value) : '—'
        },
      }),
    ),
  ]
  const shareLegend = aliases.map((alias, i) => {
    const style = pulqueriaStyle(alias)
    return {
      key: alias,
      label: String(share.data.datasets[i].label),
      swatch: { kind: 'fill' as const, color: style.color, hatched: style.hatched },
    }
  })

  const demandColumns: Column<Row>[] = [
    { key: 'day', header: 'Day', render: (r) => r.day },
    { key: 'demand', header: 'Market demand', align: 'right', render: (r) => formatQty(history[r.index].demand_total) },
    { key: 'sold', header: 'Units sold', align: 'right', render: (r) => formatQty(history[r.index].units_sold_total) },
  ]

  return (
    <div className="grid gap-8 xl:grid-cols-2">
      <ChartBox
        title="Market share by day"
        ariaLabel="Stacked bars of each pulquería's share of the units sold on each day"
        height={CHART_HEIGHT}
        legend={<Legend items={shareLegend} />}
        table={
          <DataTable
            caption="Market share by day"
            columns={shareColumns}
            rows={rows}
            rowKey={(r) => String(r.day)}
            density="compact"
          />
        }
      >
        <Bar data={share.data} options={share.options} />
      </ChartBox>
      <ChartBox
        title="Market demand vs units sold"
        ariaLabel="Lines of the market's demand and the units sold on each day"
        height={CHART_HEIGHT}
        legend={
          <Legend
            items={[
              {
                key: 'sold',
                label: 'Units sold',
                swatch: {
                  kind: 'line',
                  color: MEASURE_STYLES.sold.color,
                  dash: MEASURE_STYLES.sold.dash,
                  width: MEASURE_STYLES.sold.width,
                },
              },
              {
                key: 'demand',
                label: 'Market demand',
                swatch: {
                  kind: 'line',
                  color: MEASURE_STYLES.demand.color,
                  dash: MEASURE_STYLES.demand.dash,
                  width: MEASURE_STYLES.demand.width,
                },
              },
            ]}
          />
        }
        table={
          <DataTable
            caption="Market demand vs units sold"
            columns={demandColumns}
            rows={rows}
            rowKey={(r) => String(r.day)}
            density="compact"
          />
        }
      >
        <Line data={demandSold.data} options={demandSold.options} />
      </ChartBox>
    </div>
  )
}
