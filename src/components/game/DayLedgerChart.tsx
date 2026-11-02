import type { ReactElement } from 'react'
import { Bar } from 'react-chartjs-2'
import type { DayRecord } from '../../types/game'
import { formatMoney, formatSignedMoney } from '../../utils/format'
import { CHART_COLORS } from '../charts/chartSetup'
import ChartBox from '../shared/ChartBox'
import DataTable, { type Column } from '../shared/DataTable'
import Legend from '../shared/Legend'
import { buildDayLedgerConfig, dayLedgerSteps, type LedgerStep } from './dayLedgerConfig'

const ROW_HEIGHT = 24
const PADDING = 48

const LEGEND = [
  { key: 'in', label: 'Money in', swatch: { kind: 'fill' as const, color: CHART_COLORS['p1'] } },
  { key: 'out', label: 'Money out', swatch: { kind: 'fill' as const, color: CHART_COLORS['p2'] } },
  { key: 'profit', label: 'Profit', swatch: { kind: 'fill' as const, color: CHART_COLORS['ink'] } },
]

function signedAmount(step: LedgerStep): string {
  if (step.kind === 'in') return formatSignedMoney(step.amount)
  if (step.kind === 'out') return formatSignedMoney(-step.amount)
  return formatSignedMoney(step.amount)
}

/** One day's ledger as a waterfall from money in to money out to the day's profit (design.md §3.3). */
export default function DayLedgerChart({ record }: { record: DayRecord }): ReactElement {
  const steps = dayLedgerSteps(record)
  const config = buildDayLedgerConfig(record)
  const columns: Column<LedgerStep>[] = [
    { key: 'line', header: 'Line', render: (s) => s.label },
    { key: 'amount', header: 'Amount', align: 'right', render: signedAmount },
    { key: 'total', header: 'Running total', align: 'right', render: (s) => formatMoney(s.to) },
  ]
  return (
    <ChartBox
      title={`Day ${record.day}: where the profit came from`}
      ariaLabel={`Waterfall of day ${record.day}'s money in and out, ending at its profit`}
      height={steps.length * ROW_HEIGHT + PADDING}
      legend={<Legend items={LEGEND} />}
      table={<DataTable caption={`Day ${record.day}'s ledger`} columns={columns} rows={steps} rowKey={(s) => s.key} density="compact" />}
    >
      <Bar data={config.data} options={config.options} />
    </ChartBox>
  )
}
