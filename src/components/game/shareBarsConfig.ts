import type { ChartConfiguration } from 'chart.js'
import type { PublicDayResults } from '../../types/game'
import { formatPercent } from '../../utils/format'
import { CHART_COLORS, hatched, pulqueriaStyle } from '../charts/chartSetup'
import { resultsRows } from './ResultsTable'

const aliasNumber = (alias: string): number => Number(/^P(\d+)$/.exec(alias)?.[1] ?? Number.MAX_SAFE_INTEGER)

/** Yesterday's rows, largest share first; a tie goes to the lower alias number. */
export function shareRows(day: PublicDayResults): ReturnType<typeof resultsRows> {
  return resultsRows(day).sort((a, b) => b.market_share - a.market_share || aliasNumber(a.alias) - aliasNumber(b.alias))
}

export function buildShareBarsConfig(day: PublicDayResults, ownAlias: string): ChartConfiguration<'bar'> {
  const rows = shareRows(day)
  const n = rows.length
  const largest = rows.reduce((m, r) => Math.max(m, r.market_share), 0)
  const max = Math.min(1, Math.ceil(Number(((largest + 0.05) * 10).toFixed(6))) / 10)
  const config = {
    type: 'bar',
    data: {
      labels: rows.map((r) => r.display_name),
      datasets: [
        {
          label: 'Market share',
          data: rows.map((r) => r.market_share),
          backgroundColor: (ctx: { dataIndex: number }) => {
            const style = pulqueriaStyle(rows[ctx.dataIndex].alias)
            return style.hatched ? hatched(style.color)() : style.color
          },
          borderColor: rows.map((r) => (r.alias === ownAlias ? CHART_COLORS['ink'] : CHART_COLORS['card'])),
          borderWidth: rows.map((r) => (r.alias === ownAlias ? 2 : 0)),
          order: 1,
        },
        {
          type: 'line',
          label: `Fair share (1 ÷ ${n})`,
          data: Array.from({ length: n }, () => 1 / n),
          indexAxis: 'y',
          borderColor: CHART_COLORS['ink-muted'],
          borderWidth: 1.5,
          borderDash: [6, 4],
          pointRadius: 0,
          pointHoverRadius: 0,
          order: 0,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      scales: {
        x: {
          min: 0,
          max,
          title: { display: true, text: 'Share of units sold' },
          ticks: { callback: (value: number | string) => formatPercent(Number(value)) },
        },
      },
    },
  }
  return config as unknown as ChartConfiguration<'bar'>
}
