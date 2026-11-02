import type { ChartConfiguration } from 'chart.js'
import type { DayRecord } from '../../types/game'
import { roundCents } from '../../utils/money'
import { CHART_COLORS } from '../charts/chartSetup'

export interface LedgerStep {
  key: string
  label: string
  kind: 'in' | 'out' | 'profit'
  amount: number
  from: number
  to: number
}

type LineKey = Exclude<keyof DayRecord & string, 'day'>

const LINES: ReadonlyArray<{ key: LineKey; label: string; kind: 'in' | 'out' }> = [
  { key: 'revenue_sales', label: 'Sales revenue', kind: 'in' },
  { key: 'revenue_salvage', label: 'Salvage', kind: 'in' },
  { key: 'revenue_peer', label: 'Peer sales', kind: 'in' },
  { key: 'refund_insurance', label: 'Insurance refunds', kind: 'in' },
  { key: 'refund_futures', label: 'Futures refunds', kind: 'in' },
  { key: 'cost_spot', label: 'Spot', kind: 'out' },
  { key: 'cost_futures', label: 'Futures', kind: 'out' },
  { key: 'cost_peer', label: 'Peer purchases', kind: 'out' },
  { key: 'cost_transport', label: 'Transport', kind: 'out' },
  { key: 'cost_insurance', label: 'Insurance fees', kind: 'out' },
  { key: 'cost_conservation', label: 'Conservation', kind: 'out' },
  { key: 'cost_holding', label: 'Holding cost', kind: 'out' },
  { key: 'cost_backlog', label: 'Backlog penalty', kind: 'out' },
]

/** The day's money in, money out and profit as a running waterfall (spec 8.1); the profit bar is the record's own figure. */
export function dayLedgerSteps(record: DayRecord): LedgerStep[] {
  let total = 0
  const steps: LedgerStep[] = LINES.map(({ key, label, kind }) => {
    const amount = record[key] as number
    const from = total
    const to = roundCents(kind === 'in' ? total + amount : total - amount)
    total = to
    return { key, label, kind, amount, from, to }
  })
  steps.push({ key: 'profit', label: 'Profit', kind: 'profit', amount: record.profit, from: 0, to: record.profit })
  return steps
}

const KIND_COLOR: Record<LedgerStep['kind'], string> = {
  in: CHART_COLORS['p1'],
  out: CHART_COLORS['p2'],
  profit: CHART_COLORS['ink'],
}

export function buildDayLedgerConfig(record: DayRecord): ChartConfiguration<'bar'> {
  const steps = dayLedgerSteps(record)
  return {
    type: 'bar',
    data: {
      labels: steps.map((s) => s.label),
      datasets: [
        {
          label: 'Ledger',
          data: steps.map((s) => [s.from, s.to] as [number, number]),
          backgroundColor: steps.map((s) => KIND_COLOR[s.kind]),
          borderSkipped: false,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      scales: { x: { title: { display: true, text: '$' } } },
      plugins: { legend: { display: false } },
    },
  }
}
