import { useState, type ReactElement } from 'react'
import { Line } from 'react-chartjs-2'
import { formatMoney } from '../../utils/format'
import { pulqueriaStyle } from '../charts/chartSetup'
import ChartBox from '../shared/ChartBox'
import DataTable, { type Column } from '../shared/DataTable'
import Legend from '../shared/Legend'
import { buildProfitRaceConfig } from './resultsChartsConfig'
import type { ResultsView } from './resultsView'

interface RaceRow {
  index: number
  day: string
}

/** Block 1 of spec §13.8: each pulquería's running profit, ending at its total profit. */
export default function ProfitRaceChart({ view, myAlias }: { view: ResultsView; myAlias: string | null }): ReactElement {
  const [pointed, setPointed] = useState<string | null>(null)
  const config = buildProfitRaceConfig(view, pointed ?? myAlias)
  const datasets = config.data.datasets

  const rows: RaceRow[] = Array.from({ length: config.data.labels?.length ?? 0 }, (_, index) => {
    const label = config.data.labels?.[index] as string[]
    return { index, day: label[0] }
  })
  const columns: Column<RaceRow>[] = [
    { key: 'day', header: 'Day', render: (r) => r.day },
    ...view.players.map(
      (p, i): Column<RaceRow> => ({
        key: p.alias,
        header: p.display_name,
        align: 'right',
        render: (r) => {
          const value = datasets[i]?.data[r.index]
          return typeof value === 'number' ? formatMoney(value) : '—'
        },
      }),
    ),
  ]

  const legend = (
    <Legend
      items={view.players.map((p) => {
        const style = pulqueriaStyle(p.alias)
        return {
          key: p.alias,
          label: p.display_name,
          swatch: {
            kind: 'line' as const,
            color: style.color,
            dash: style.dashed ? [6, 4] : [],
            pointStyle: style.pointStyle,
          },
        }
      })}
      onFocusItem={setPointed}
    />
  )

  return (
    <ChartBox
      title="Profit race"
      caption="Running total of each pulquería's daily profit. End adds the final settlement."
      ariaLabel="Line chart of each pulquería's running profit on each day played, ending at its total profit"
      height={320}
      legend={legend}
      table={<DataTable caption="Profit race" columns={columns} rows={rows} rowKey={(r) => String(r.index)} density="compact" />}
    >
      <Line data={config.data} options={config.options} />
    </ChartBox>
  )
}
