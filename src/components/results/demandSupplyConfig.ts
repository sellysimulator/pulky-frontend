import type { ChartConfiguration, ChartOptions } from 'chart.js'
import { MEASURE_STYLES, hatched } from '../charts/chartSetup'
import { weekdayShort } from '../../utils/format'
import type { ResultsView } from './resultsView'

export type DemandSupplySeries = 'demand' | 'delivered' | 'sold' | 'spoiled' | 'backlog'

export const DEMAND_SUPPLY_LEGEND_ORDER: DemandSupplySeries[] = ['demand', 'delivered', 'sold', 'spoiled', 'backlog']

export const DEMAND_SUPPLY_LABELS: Record<DemandSupplySeries, string> = {
  demand: 'Market demand',
  delivered: 'Pulque delivered',
  sold: 'Units sold',
  spoiled: 'Units spoiled',
  backlog: 'Backlog at day end',
}

/** Datasets are drawn in this order, so demand, the last, lands on top (design.md §3.3). */
const DRAW_ORDER: DemandSupplySeries[] = ['delivered', 'sold', 'spoiled', 'backlog', 'demand']

function dayLabels(view: ResultsView): string[][] {
  return Array.from({ length: view.days_played }, (_, i) => [String(i + 1), weekdayShort(view.market.weekday[i])])
}

function seriesData(view: ResultsView, series: DemandSupplySeries): number[] {
  const m = view.market
  switch (series) {
    case 'demand':
      return m.demand
    case 'delivered':
      return m.delivered
    case 'sold':
      return m.sold
    case 'spoiled':
      return m.spoiled
    case 'backlog':
      return m.backlog_end
  }
}

/** Block 2 of spec §13.8: the plotted values for the visible series, demand last. */
export function buildDemandSupplyConfig(
  view: ResultsView,
  visible: DemandSupplySeries[],
): ChartConfiguration<'line'> {
  const peakDays = view.market.weekday_multiplier.flatMap((m, i) => (m === 1 ? [i] : []))
  const datasets = DRAW_ORDER.filter((s) => visible.includes(s)).map((s) => {
    const style = MEASURE_STYLES[s]
    return {
      label: DEMAND_SUPPLY_LABELS[s],
      data: seriesData(view, s),
      borderColor: style.color,
      backgroundColor: style.color,
      borderWidth: style.width,
      borderDash: style.dash,
      pointStyle: style.pointStyle,
      pointRadius: 0,
      pointHoverRadius: 5,
    }
  })
  const options = {
    scales: {
      x: { title: { display: true, text: 'Day' } },
      y: { beginAtZero: true, title: { display: true, text: 'Units' } },
    },
    plugins: { peakShading: { days: peakDays } },
  } as ChartOptions<'line'>
  return { type: 'line', data: { labels: dayLabels(view), datasets }, options }
}

/** Block 3: one stacked horizontal bar per pulquería, in rank order; a missing peer field adds no segment. */
export function buildWherePulqueWentConfig(view: ResultsView): ChartConfiguration<'bar'> {
  const players = view.players
  const datasets: ChartConfiguration<'bar'>['data']['datasets'] = [
    {
      label: 'Sold',
      data: players.map((p) => p.units_sold),
      backgroundColor: MEASURE_STYLES.sold.color,
    },
  ]
  if (players.length > 0 && players.every((p) => typeof p.peer_units_sold === 'number')) {
    datasets.push({
      label: 'Sold to pulquerías',
      data: players.map((p) => p.peer_units_sold as number),
      backgroundColor: hatched(MEASURE_STYLES.sold.color),
    })
  }
  datasets.push(
    {
      label: 'Spoiled',
      data: players.map((p) => p.units_spoiled),
      backgroundColor: MEASURE_STYLES.spoiled.color,
    },
    {
      label: 'Lost in transit',
      data: players.map((p) => p.units_lost_transport),
      backgroundColor: MEASURE_STYLES.lost.color,
    },
    {
      label: 'Liquidated at the end',
      data: players.map((p) => p.liquidated_units),
      backgroundColor: MEASURE_STYLES.liquidated.color,
    },
  )
  const options = {
    indexAxis: 'y',
    scales: {
      x: { stacked: true, title: { display: true, text: 'Units' } },
      y: { stacked: true },
    },
  } as ChartOptions<'bar'>
  return { type: 'bar', data: { labels: players.map((p) => p.display_name), datasets }, options }
}

/** The largest daily peer value of any pulquería, which sets the shared y range of block 5's peer group. */
function largestPeerDay(view: ResultsView): number {
  let largest = 0
  for (const p of view.players) {
    for (const v of p.series.peer_bought ?? []) largest = Math.max(largest, v)
    for (const v of p.series.peer_sold ?? []) largest = Math.max(largest, v)
  }
  return largest
}

/** Block 5: bought above zero, sold below zero, one y range for every pulquería. */
export function buildPeerUnitsConfig(view: ResultsView, alias: string): ChartConfiguration<'bar'> {
  const player = view.players.find((p) => p.alias === alias)
  const bought = player?.series.peer_bought ?? []
  const sold = player?.series.peer_sold ?? []
  const limit = largestPeerDay(view)
  const options = {
    scales: {
      x: { stacked: true, title: { display: true, text: 'Day' } },
      y: { stacked: true, min: -limit, max: limit, title: { display: true, text: 'Units' } },
    },
  } as ChartOptions<'bar'>
  return {
    type: 'bar',
    data: {
      labels: Array.from({ length: view.days_played }, (_, i) => String(i + 1)),
      datasets: [
        {
          label: 'Bought',
          data: bought,
          backgroundColor: hatched(MEASURE_STYLES.delivered.color),
        },
        {
          label: 'Sold',
          data: sold.map((v) => (v === 0 ? 0 : -v)),
          backgroundColor: hatched(MEASURE_STYLES.sold.color),
        },
      ],
    },
    options,
  }
}
