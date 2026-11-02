import type { ReactElement } from 'react'
import { Line } from 'react-chartjs-2'
import { formatMoney, formatPercent } from '../../utils/format'
import { CHART_COLORS, pulqueriaStyle } from '../charts/chartSetup'
import ChartBox from '../shared/ChartBox'
import DataTable, { type Column } from '../shared/DataTable'
import Legend from '../shared/Legend'
import { buildTradeoffConfig } from './resultsChartsConfig'
import type { PulqueriaResultView, ResultsView } from './resultsView'

interface TradeoffRow {
  key: string
  name: string
  waste: number
  fill: number
  profit: number | null
}

function reasonFor(p: PulqueriaResultView): string {
  if (p.fill_rate === null && p.waste_rate === null) return 'no demand was owed, and nothing was sold or spoiled'
  return p.fill_rate === null ? 'no demand was owed' : 'nothing was sold or spoiled'
}

/** Block 4 of spec §13.8: fill rate against waste rate, sized by total profit. */
export default function TradeoffChart({ view, myAlias }: { view: ResultsView; myAlias: string | null }): ReactElement {
  const plotted = view.players.filter((p) => p.fill_rate !== null && p.waste_rate !== null)
  if (plotted.length === 0) {
    return <p className="text-sm text-ink-muted">No pulquería has both a fill rate and a waste rate to plot.</p>
  }
  const skipped = view.players.filter((p) => p.fill_rate === null || p.waste_rate === null)
  const config = buildTradeoffConfig(view, myAlias)
  const caption =
    'Size is total profit.' +
    (skipped.length > 0 ? ` Not plotted: ${skipped.map((p) => `${p.display_name} (${reasonFor(p)})`).join('; ')}.` : '')

  const mean = (pick: (p: PulqueriaResultView) => number): number =>
    plotted.reduce((sum, p) => sum + pick(p), 0) / plotted.length
  const rows: TradeoffRow[] = [
    ...plotted.map((p) => ({
      key: p.alias,
      name: p.display_name,
      waste: p.waste_rate as number,
      fill: p.fill_rate as number,
      profit: p.total_profit,
    })),
    { key: 'average', name: 'Average', waste: mean((p) => p.waste_rate as number), fill: mean((p) => p.fill_rate as number), profit: null },
  ]
  const columns: Column<TradeoffRow>[] = [
    { key: 'name', header: 'Pulquería', render: (r) => r.name },
    { key: 'waste', header: 'Waste rate', align: 'right', render: (r) => formatPercent(r.waste) },
    { key: 'fill', header: 'Fill rate', align: 'right', render: (r) => formatPercent(r.fill) },
    { key: 'profit', header: 'Total profit', align: 'right', render: (r) => (r.profit === null ? '—' : formatMoney(r.profit)) },
  ]

  const legend = (
    <Legend
      items={[
        ...plotted.map((p) => {
          const style = pulqueriaStyle(p.alias)
          return {
            key: p.alias,
            label: p.display_name,
            swatch: { kind: 'fill' as const, color: style.color, hatched: style.hatched },
          }
        }),
        ...['Average waste rate', 'Average fill rate'].map((label) => ({
          key: label,
          label,
          swatch: { kind: 'line' as const, color: CHART_COLORS['ink-muted'], dash: [6, 4] },
        })),
      ]}
    />
  )

  return (
    <ChartBox
      title="Fill rate vs waste rate"
      caption={caption}
      ariaLabel="Chart of each pulquería's fill rate against its waste rate, sized by total profit"
      height={320}
      legend={legend}
      table={<DataTable caption="Fill rate vs waste rate" columns={columns} rows={rows} rowKey={(r) => r.key} density="compact" />}
    >
      <Line data={config.data} options={config.options} />
    </ChartBox>
  )
}
