import type { ChartConfiguration, ChartOptions } from 'chart.js'
import type { SankeyDataPoint, SankeyScriptableContext } from 'chartjs-chart-sankey'
import type { Weekday } from '../../types/game'
import { formatPercent, formatQty, weekdayShort } from '../../utils/format'
import { CHART_COLORS, emphasisOf, hatchPattern, hatched, pulqueriaLine, pulqueriaStyle } from '../charts/chartSetup'
import type { ResultsView } from './resultsView'

// ── The race (spec §13.8 block 1) ──

export interface RaceLine {
  alias: string
  name: string
  /** The server's profit so far after each day (spec §8.6 `cumulative_profit`, §12.5). */
  cumulative: number[]
  total?: number
}

export interface RaceInput {
  weekdays: Weekday[]
  peak: boolean[]
  lines: RaceLine[]
}

const END_LABEL_MAX_LINES = 6
const END_LABEL_PADDING_PX = 112

/** Each line's profit so far, one point per day as the server sent it, then the final total as End when every line has one. */
export function buildRaceConfig(input: RaceInput, focus: string | null): ChartConfiguration<'line'> {
  const { weekdays, peak, lines } = input
  const withEnd = lines.length > 0 && lines.every((line) => line.total !== undefined)
  const labels: string[][] = weekdays.map((weekday, i) => [String(i + 1), weekdayShort(weekday)])
  if (withEnd) labels.push(['End'])

  const datasets = lines.map((line) => {
    const data: number[] = line.cumulative.slice(0, weekdays.length)
    if (withEnd && line.total !== undefined) data.push(line.total)
    return { label: line.name, data, ...pulqueriaLine(line.alias, emphasisOf(line.alias, focus)) }
  })

  const bands = peak.flatMap((isPeak, i) => (isPeak && i < weekdays.length ? [{ index: i, tone: 'peak' as const }] : []))
  const endLabels = lines.length <= END_LABEL_MAX_LINES
  const options = {
    scales: {
      x: { title: { display: true, text: 'Day' } },
      y: { title: { display: true, text: '$' } },
    },
    layout: { padding: { right: endLabels ? END_LABEL_PADDING_PX : 0 } },
    plugins: {
      eventBands: { bands },
      lineEndLabels: { display: endLabels },
    },
  } as unknown as ChartOptions<'line'>
  return { type: 'line', data: { labels, datasets }, options }
}

/** Block 1: the race of the finished game, ending at each total profit. */
export function buildProfitRaceConfig(view: ResultsView, focus: string | null): ChartConfiguration<'line'> {
  const days = view.days_played
  return buildRaceConfig(
    {
      weekdays: view.market.weekday.slice(0, days),
      peak: view.market.weekday_multiplier.slice(0, days).map((m) => m === 1),
      lines: view.players.map((p) => ({
        alias: p.alias,
        name: p.display_name,
        cumulative: p.series.cumulative_profit,
        total: p.total_profit,
      })),
    },
    focus,
  )
}

// ── Fill vs waste (block 4) ──

const RADIUS_BASE = 6
const RADIUS_SPAN = 14
const RADIUS_FLAT = 13

const roundTo6 = (value: number): number => Number(value.toFixed(6))

export function buildTradeoffConfig(view: ResultsView, myAlias: string | null): ChartConfiguration<'line'> {
  const plotted = view.players.flatMap((p) =>
    p.fill_rate !== null && p.waste_rate !== null ? [{ player: p, fill: p.fill_rate, waste: p.waste_rate }] : [],
  )
  const options = {
    interaction: { mode: 'nearest', intersect: true },
    plugins: {
      quadrantLabels: {
        topLeft: 'Served and fresh',
        topRight: 'Served by overstocking',
        bottomLeft: 'Lean but short',
        bottomRight: 'Short and wasting',
      },
    },
  } as unknown as ChartOptions<'line'>
  if (plotted.length === 0) return { type: 'line', data: { datasets: [] }, options }

  const profits = plotted.map((e) => e.player.total_profit)
  const pmin = Math.min(...profits)
  const pmax = Math.max(...profits)
  const wmax = Math.max(...plotted.map((e) => e.waste))
  const fmin = Math.min(...plotted.map((e) => e.fill))
  const xMax = Math.min(1, Math.ceil(roundTo6((wmax + 0.05) * 10)) / 10)
  const yMin = Math.max(0, Math.floor(roundTo6((fmin - 0.05) * 10)) / 10)
  const mw = plotted.reduce((sum, e) => sum + e.waste, 0) / plotted.length
  const mf = plotted.reduce((sum, e) => sum + e.fill, 0) / plotted.length

  const points = plotted.map(({ player, fill, waste }) => {
    const style = pulqueriaStyle(player.alias)
    const r = pmin === pmax ? RADIUS_FLAT : RADIUS_BASE + (RADIUS_SPAN * (player.total_profit - pmin)) / (pmax - pmin)
    const mine = player.alias === myAlias
    return {
      label: player.display_name,
      data: [{ x: waste, y: fill }],
      order: 1,
      showLine: false,
      pointStyle: style.pointStyle,
      pointRadius: r,
      pointHoverRadius: r + 2,
      pointBackgroundColor: style.hatched ? hatched(style.color) : `${style.color}CC`,
      pointBorderColor: mine ? CHART_COLORS['ink'] : CHART_COLORS['card'],
      pointBorderWidth: mine ? 2 : 1,
    }
  })
  const rule = {
    order: 2,
    showLine: true,
    borderColor: CHART_COLORS['ink-muted'],
    borderWidth: 1.5,
    borderDash: [6, 4],
    pointRadius: 0,
    pointHoverRadius: 0,
  }
  const datasets = [
    ...points,
    {
      ...rule,
      label: 'Average waste rate',
      data: [
        { x: mw, y: yMin },
        { x: mw, y: 1 },
      ],
    },
    {
      ...rule,
      label: 'Average fill rate',
      data: [
        { x: 0, y: mf },
        { x: xMax, y: mf },
      ],
    },
  ]
  const percentTicks = { callback: (value: string | number) => formatPercent(Number(value)) }
  const scales = {
    x: { type: 'linear', min: 0, max: xMax, title: { display: true, text: 'Waste rate' }, ticks: percentTicks },
    y: { type: 'linear', min: yMin, max: 1, title: { display: true, text: 'Fill rate' }, ticks: percentTicks },
  }
  return {
    type: 'line',
    data: { datasets } as unknown as ChartConfiguration<'line'>['data'],
    options: { ...options, scales } as unknown as ChartOptions<'line'>,
  }
}

// ── The flow (block 3) ──

export type FlowNode =
  | 'spot'
  | 'futures'
  | 'pipeline'
  | 'shipped'
  | 'lost'
  | 'in_transit'
  | 'delivered'
  | 'initial'
  | 'bought'
  | 'cellar'
  | 'sold'
  | 'peer_sold'
  | 'spoiled'
  | 'left'

export const FLOW_NODE_NAMES: Record<FlowNode, string> = {
  spot: 'Spot shipments',
  futures: 'Futures shipments',
  pipeline: 'On the way at the start',
  shipped: 'Shipped',
  lost: 'Lost in transit',
  in_transit: 'Still in transit at the end',
  delivered: 'Delivered',
  initial: 'Initial stock',
  bought: 'Bought from pulquerías',
  cellar: 'Cellar',
  sold: 'Sold to customers',
  peer_sold: 'Sold to pulquerías',
  spoiled: 'Spoiled',
  left: 'Left at the end',
}

const NODE_ORDER = Object.keys(FLOW_NODE_NAMES) as FlowNode[]

const NODE_COLUMN: Record<FlowNode, number> = {
  spot: 0,
  futures: 0,
  pipeline: 0,
  shipped: 1,
  lost: 2,
  in_transit: 2,
  delivered: 2,
  initial: 2,
  bought: 2,
  cellar: 3,
  sold: 4,
  peer_sold: 4,
  spoiled: 4,
  left: 4,
}

const SHIPPED_SHARE: readonly FlowNode[] = ['spot', 'futures', 'pipeline', 'lost', 'in_transit', 'delivered']
const CELLAR_SHARE: readonly FlowNode[] = ['initial', 'bought', 'sold', 'peer_sold', 'spoiled', 'left']

/** The colour of an outcome node's band; `undefined` for the pass-through nodes. */
function outcomeColor(node: string): string | CanvasPattern | undefined {
  switch (node) {
    case 'lost':
      return CHART_COLORS['series-lost']
    case 'in_transit':
    case 'left':
      return CHART_COLORS['series-liquidated']
    case 'sold':
      return CHART_COLORS['series-sold']
    case 'peer_sold':
      return hatchPattern(CHART_COLORS['series-sold'])
    case 'spoiled':
      return CHART_COLORS['series-spoiled']
    default:
      return undefined
  }
}

const bandColor = (ctx: SankeyScriptableContext): string | CanvasPattern =>
  outcomeColor(ctx.raw.to) ?? `${CHART_COLORS['ink-subtle']}66`
const nodeColorFrom = (ctx: SankeyScriptableContext): string | CanvasPattern =>
  outcomeColor(ctx.raw.from) ?? CHART_COLORS['ink-subtle']
const nodeColorTo = (ctx: SankeyScriptableContext): string | CanvasPattern =>
  outcomeColor(ctx.raw.to) ?? CHART_COLORS['ink-subtle']

/** Every band is a field of the server's `flow`; nothing is computed here, and a band of 0 is left out. */
export function buildPulqueFlowConfig(view: ResultsView, alias: string): ChartConfiguration<'sankey'> {
  const f = view.players.find((p) => p.alias === alias)?.flow
  const data: SankeyDataPoint[] = []
  const labels: Record<string, string> = {}

  if (f) {
    const bands: [FlowNode, FlowNode, number][] = [
      ['spot', 'shipped', f.shipped_spot],
      ['futures', 'shipped', f.shipped_futures],
      ['pipeline', 'shipped', f.initial_pipeline],
      ['shipped', 'lost', f.lost_transport],
      ['shipped', 'in_transit', f.in_transit_end],
      ['shipped', 'delivered', f.delivered],
      ['delivered', 'cellar', f.delivered],
      ['initial', 'cellar', f.initial_stock],
      ['bought', 'cellar', f.peer_bought],
      ['cellar', 'sold', f.sold],
      ['cellar', 'peer_sold', f.peer_sold],
      ['cellar', 'spoiled', f.spoiled],
      ['cellar', 'left', f.closing_stock],
    ]
    for (const [from, to, flow] of bands) if (flow > 0) data.push({ from, to, flow })

    // Display arithmetic for labels only; these two sums are never a band.
    const shippedUnits = f.initial_pipeline + f.shipped_spot + f.shipped_futures
    const cellarUnits = f.initial_stock + f.delivered + f.peer_bought
    const units: Record<FlowNode, number> = {
      spot: f.shipped_spot,
      futures: f.shipped_futures,
      pipeline: f.initial_pipeline,
      shipped: shippedUnits,
      lost: f.lost_transport,
      in_transit: f.in_transit_end,
      delivered: f.delivered,
      initial: f.initial_stock,
      bought: f.peer_bought,
      cellar: cellarUnits,
      sold: f.sold,
      peer_sold: f.peer_sold,
      spoiled: f.spoiled,
      left: f.closing_stock,
    }
    const appearing = new Set<string>(data.flatMap((d) => [d.from, d.to]))
    for (const node of NODE_ORDER) {
      if (!appearing.has(node)) continue
      let text = `${FLOW_NODE_NAMES[node]}\n${formatQty(units[node])}`
      const base = SHIPPED_SHARE.includes(node) ? shippedUnits : CELLAR_SHARE.includes(node) ? cellarUnits : null
      if (base !== null) text += ` · ${formatPercent(base === 0 ? 0 : units[node] / base)}`
      labels[node] = text
    }
  }

  const dataset = {
    data,
    labels,
    column: { ...NODE_COLUMN },
    priority: Object.fromEntries(NODE_ORDER.map((node, i) => [node, i])),
    flowColor: bandColor,
    hoverFlowColor: bandColor,
    colorFrom: nodeColorFrom,
    colorTo: nodeColorTo,
    colorMode: 'to' as const,
    nodeLabels: { color: CHART_COLORS['ink'] },
    nodeWidth: 10,
    size: 'max' as const,
    parsing: { from: 'from', to: 'to', flow: 'flow' },
  }
  return { type: 'sankey', data: { datasets: [dataset] } as unknown as ChartConfiguration<'sankey'>['data'] }
}
