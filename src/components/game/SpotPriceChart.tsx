import type { ChartData, ChartOptions } from 'chart.js'
import type { ReactElement } from 'react'
import { Line } from 'react-chartjs-2'
import type { PublicDayResults } from '../../types/game'
import { formatMoney, weekdayShort } from '../../utils/format'
import { CHART_COLORS } from '../charts/chartSetup'
import ChartBox from '../shared/ChartBox'
import DataTable, { type Column } from '../shared/DataTable'
import Legend from '../shared/Legend'

interface SpotPriceChartProps {
  publicHistory: PublicDayResults[]
  basePrice: number | null
}

interface Row {
  day: number
  spot: number
  base: number | null
}

const OPTIONS: ChartOptions<'line'> = {
  scales: {
    x: { title: { display: true, text: 'Day' } },
    y: { title: { display: true, text: '$' } },
  },
}

/** Spec §9.3: the player's chart has the spot line and the base price only, never a spot-range band. */
export default function SpotPriceChart({ publicHistory, basePrice }: SpotPriceChartProps): ReactElement {
  const rows: Row[] = publicHistory.map((p) => ({ day: p.day, spot: p.spot_price, base: basePrice }))
  const columns: Column<Row>[] = [
    { key: 'day', header: 'Day', render: (r) => r.day },
    { key: 'spot', header: 'Spot', align: 'right', render: (r) => formatMoney(r.spot) },
    { key: 'base', header: 'Base', align: 'right', render: (r) => (r.base === null ? '—' : formatMoney(r.base)) },
  ]
  const datasets: ChartData<'line'>['datasets'] = [
    {
      label: 'Spot',
      data: rows.map((r) => r.spot),
      borderColor: CHART_COLORS['p1'],
      backgroundColor: CHART_COLORS['p1'],
      borderWidth: 2.5,
      pointRadius: 4,
    },
  ]
  if (basePrice !== null) {
    datasets.push({
      label: 'Base',
      data: rows.map((r) => r.base),
      borderColor: CHART_COLORS['ink-muted'],
      backgroundColor: CHART_COLORS['ink-muted'],
      borderWidth: 1.5,
      borderDash: [6, 4],
      pointRadius: 0,
    })
  }
  const data: ChartData<'line'> = {
    labels: publicHistory.map((p) => [String(p.day), weekdayShort(p.weekday)]),
    datasets,
  }
  return (
    <ChartBox
      title="Spot price"
      ariaLabel="Line chart of the spot price on each day played, with the base price as a dashed reference line"
      height={240}
      legend={
        <Legend
          items={[
            { key: 'spot', label: 'Spot', swatch: { kind: 'line', color: CHART_COLORS['p1'], pointStyle: 'circle' } },
            { key: 'base', label: 'Base', swatch: { kind: 'line', color: CHART_COLORS['ink-muted'], dash: [6, 4] } },
          ]}
        />
      }
      table={<DataTable caption="Spot price" columns={columns} rows={rows} rowKey={(r) => String(r.day)} density="compact" />}
    >
      <Line data={data} options={OPTIONS} />
    </ChartBox>
  )
}
