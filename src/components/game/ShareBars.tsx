import type { ReactElement } from 'react'
import { Bar } from 'react-chartjs-2'
import type { PublicDayResults } from '../../types/game'
import { formatPercent } from '../../utils/format'
import { CHART_COLORS } from '../charts/chartSetup'
import { PulqueriaChip } from '../shared/Badge'
import ChartBox from '../shared/ChartBox'
import DataTable, { type Column } from '../shared/DataTable'
import Legend from '../shared/Legend'
import StatTile from '../shared/StatTile'
import type { ResultsRow } from './ResultsTable'
import { buildShareBarsConfig, shareRows } from './shareBarsConfig'

const SPARK_WIDTH = 96
const SPARK_HEIGHT = 24
const SPARK_PAD = 3

/** The own market share over the days played; 0 at the bottom, the largest value at the top. */
function Sparkline({ values }: { values: number[] }): ReactElement {
  const top = SPARK_PAD
  const bottom = SPARK_HEIGHT - SPARK_PAD
  const max = Math.max(...values)
  const y = (v: number): number => (max > 0 ? bottom - (v / max) * (bottom - top) : bottom)
  const x = (i: number): number => SPARK_PAD + (i * (SPARK_WIDTH - 2 * SPARK_PAD)) / (values.length - 1)
  return (
    <svg width={SPARK_WIDTH} height={SPARK_HEIGHT} viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`} aria-hidden="true">
      {values.length === 1 ? (
        <circle cx={SPARK_WIDTH / 2} cy={y(values[0])} r="3" fill="currentColor" className="text-accent" />
      ) : (
        <polyline
          points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
          stroke="currentColor"
          className="text-accent"
          strokeWidth={1.5}
          fill="none"
        />
      )}
    </svg>
  )
}

interface ShareBarsProps {
  day: PublicDayResults
  ownAlias: string
  publicHistory: PublicDayResults[]
}

/** Yesterday's market share: the player's own share as a tile and every pulquería's as horizontal bars. */
export default function ShareBars({ day, ownAlias, publicHistory }: ShareBarsProps): ReactElement {
  const rows = shareRows(day)
  const n = rows.length
  const config = buildShareBarsConfig(day, ownAlias)
  const own = day.players[ownAlias]?.market_share ?? null
  const series = publicHistory.flatMap((d) => {
    const mine = d.players[ownAlias]
    return mine ? [mine.market_share] : []
  })
  const columns: Column<ResultsRow>[] = [
    {
      key: 'name',
      header: 'Pulquería',
      render: (r) => <PulqueriaChip alias={r.alias} displayName={r.display_name} you={r.alias === ownAlias} />,
    },
    { key: 'share', header: 'Share', align: 'right', render: (r) => formatPercent(r.market_share) },
  ]
  return (
    <div className="flex flex-col gap-3">
      <StatTile
        label="Your market share"
        value={formatPercent(own)}
        sub={series.length > 0 ? <Sparkline values={series} /> : undefined}
      />
      <ChartBox
        title="Market share yesterday"
        ariaLabel="Horizontal bars of each pulquería's share of yesterday's market, largest first, with the fair share marked"
        height={28 * n + 48}
        legend={
          <Legend
            items={[{ key: 'fair', label: `Fair share (1 ÷ ${n})`, swatch: { kind: 'line', color: CHART_COLORS['ink-muted'], dash: [6, 4] } }]}
          />
        }
        table={<DataTable caption="Market share yesterday" columns={columns} rows={rows} rowKey={(r) => r.alias} density="compact" />}
      >
        <Bar data={config.data} options={config.options} />
      </ChartBox>
    </div>
  )
}
