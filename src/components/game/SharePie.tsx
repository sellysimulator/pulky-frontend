import type { ChartData, ChartOptions } from 'chart.js'
import type { ReactElement } from 'react'
import { Pie } from 'react-chartjs-2'
import type { PublicDayResults } from '../../types/game'
import { formatPercent } from '../../utils/format'
import { CHART_COLORS, pulqueriaStyle } from '../charts/chartSetup'
import ChartBox from '../shared/ChartBox'
import DataTable, { type Column } from '../shared/DataTable'
import Legend from '../shared/Legend'
import { PulqueriaChip } from '../shared/Badge'
import { resultsRows, type ResultsRow } from './ResultsTable'

/** Design.md §3.1: P7-P12 are the slot colour crossed by 1.5px card-coloured stripes, drawn lazily on a canvas pattern. */
function hatch(color: string): () => CanvasPattern | string {
  return () => {
    const tile = document.createElement('canvas')
    tile.width = 6
    tile.height = 6
    const ctx = tile.getContext('2d')
    if (!ctx) return color
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 6, 6)
    ctx.strokeStyle = CHART_COLORS['card']
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(-1, 7)
    ctx.lineTo(7, -1)
    ctx.stroke()
    return ctx.createPattern(tile, 'repeat') ?? color
  }
}

const OPTIONS: ChartOptions<'pie'> = {}

export default function SharePie({ day, ownAlias }: { day: PublicDayResults; ownAlias: string }): ReactElement {
  const rows = resultsRows(day)
  const styles = rows.map((r) => pulqueriaStyle(r.alias))
  const data: ChartData<'pie'> = {
    labels: rows.map((r) => r.display_name),
    datasets: [
      {
        data: rows.map((r) => r.market_share),
        backgroundColor: rows.map((_, i) => (styles[i].hatched ? hatch(styles[i].color) : styles[i].color)) as never,
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
