import type { ChartData, ChartOptions } from 'chart.js'
import type { ReactElement } from 'react'
import { Bar } from 'react-chartjs-2'
import type { StockByAge } from '../../types/game'
import { formatPercent, formatQty } from '../../utils/format'
import { CHART_COLORS } from '../charts/chartSetup'
import ChartBox from '../shared/ChartBox'
import DataTable, { type Column } from '../shared/DataTable'
import Legend from '../shared/Legend'

/** The x tick: the age, then one line per stack present at that age with its average risk tonight (design.md §3.3). */
function tick(row: StockByAge): string[] {
  const lines = [String(row.age)]
  if (row.plain_qty > 0) lines.push(`plain ${formatPercent(row.plain_risk_tonight)}`)
  if (row.conserved_qty > 0) lines.push(`conserved ${formatPercent(row.conserved_risk_tonight)}`)
  return lines
}

const COLUMNS: Column<StockByAge>[] = [
  { key: 'age', header: 'Age', render: (r) => r.age },
  { key: 'plain', header: 'Plain', align: 'right', render: (r) => formatQty(r.plain_qty) },
  { key: 'conserved', header: 'Conserved', align: 'right', render: (r) => formatQty(r.conserved_qty) },
  { key: 'plain-risk', header: 'Avg risk tonight (plain)', align: 'right', render: (r) => formatPercent(r.plain_risk_tonight ?? null) },
  {
    key: 'conserved-risk',
    header: 'Avg risk tonight (conserved)',
    align: 'right',
    render: (r) => formatPercent(r.conserved_risk_tonight ?? null),
  },
]

const OPTIONS: ChartOptions<'bar'> = {
  scales: {
    x: { stacked: true, title: { display: true, text: 'Age (days)' } },
    y: { stacked: true, title: { display: true, text: 'Units' } },
  },
}

export default function StockByAgeChart({ rows }: { rows: StockByAge[] }): ReactElement {
  const data: ChartData<'bar'> = {
    labels: rows.map(tick),
    datasets: [
      {
        label: 'Plain',
        data: rows.map((r) => r.plain_qty),
        backgroundColor: CHART_COLORS['p4'],
        borderColor: CHART_COLORS['card'],
        borderWidth: 1,
      },
      {
        label: 'Conserved',
        data: rows.map((r) => r.conserved_qty),
        backgroundColor: CHART_COLORS['p1'],
        borderColor: CHART_COLORS['card'],
        borderWidth: 1,
      },
    ],
  }
  return (
    <ChartBox
      title="Units by age"
      ariaLabel="Stacked bars of plain and conserved units in the cellar by age in days, with tonight's average spoil risk under each age"
      height={240}
      legend={
        <Legend
          items={[
            { key: 'plain', label: 'Plain', swatch: { kind: 'fill', color: CHART_COLORS['p4'] } },
            { key: 'conserved', label: 'Conserved', swatch: { kind: 'fill', color: CHART_COLORS['p1'] } },
          ]}
        />
      }
      table={<DataTable caption="Units by age" columns={COLUMNS} rows={rows} rowKey={(r) => String(r.age)} density="compact" />}
    >
      <Bar data={data} options={OPTIONS} />
    </ChartBox>
  )
}
