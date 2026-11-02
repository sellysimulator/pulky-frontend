import type { ChartData, ChartOptions } from 'chart.js'
import type { ReactElement } from 'react'
import { Pie } from 'react-chartjs-2'
import type { PublicDayResults } from '../../types/game'
import { formatPercent } from '../../utils/format'
import { CHART_COLORS, pulqueriaStyle , hatched } from '../charts/chartSetup'
import ChartBox from '../shared/ChartBox'
import DataTable, { type Column } from '../shared/DataTable'
import Legend from '../shared/Legend'
import { PulqueriaChip } from '../shared/Badge'
import { resultsRows, type ResultsRow } from './ResultsTable'

const OPTIONS: ChartOptions<'pie'> = {}

export default function SharePie({ day, ownAlias }: { day: PublicDayResults; ownAlias: string }): ReactElement {
  const rows = resultsRows(day)
  const styles = rows.map((r) => pulqueriaStyle(r.alias))
  const data: ChartData<'pie'> = {
    labels: rows.map((r) => r.display_name),
    datasets: [
      {
        data: rows.map((r) => r.market_share),
        backgroundColor: rows.map((_, i) => (styles[i].hatched ? hatched(styles[i].color) : styles[i].color)) as never,
        borderColor: rows.map((r) => (r.alias === ownAlias ? CHART_COLORS['ink'] : CHART_COLORS['card'])),
        borderWidth: 2,
        offset: rows.map((r) => (r.alias === ownAlias ? 10 : 0)),
      },
    ],
  }
  const columns: Column<ResultsRow>[] = [
    {
      key: 'name',
      header: 'Pulquería',
      render: (r) => <PulqueriaChip alias={r.alias} displayName={r.display_name} you={r.alias === ownAlias} />,
    },
    { key: 'share', header: 'Share', align: 'right', render: (r) => formatPercent(r.market_share) },
  ]
  return (
    <ChartBox
      title="Market share yesterday"
      ariaLabel="Pie chart of each pulquería's share of yesterday's market"
      height={240}
      legend={
        <Legend
          items={rows.map((r, i) => ({
            key: r.alias,
            label: r.alias === ownAlias ? `${r.display_name} (you)` : r.display_name,
            swatch: { kind: 'fill', color: styles[i].color, hatched: styles[i].hatched },
          }))}
        />
      }
      table={<DataTable caption="Market share yesterday" columns={columns} rows={rows} rowKey={(r) => r.alias} density="compact" />}
    >
      <Pie data={data} options={OPTIONS} />
    </ChartBox>
  )
}
