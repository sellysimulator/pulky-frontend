import type { ChartConfiguration } from 'chart.js'
import { weekdayShort } from '../../utils/format'
import { MEASURE_STYLES, hatched, pulqueriaStyle } from '../charts/chartSetup'
import type { PresentationDay } from './presentationData'

function aliasNumber(alias: string): number {
  return Number(/^P(\d+)$/.exec(alias)?.[1] ?? Number.MAX_SAFE_INTEGER)
}

function labelsOf(history: PresentationDay[]): string[][] {
  return history.map((entry) => [String(entry.day), weekdayShort(entry.weekday)])
}

/** Stacked bars of each pulquería's share of the units sold, by day (projector, public data only). */
export function buildShareByDayConfig(history: PresentationDay[]): ChartConfiguration<'bar'> {
  const aliases = [...new Set(history.flatMap((entry) => Object.keys(entry.shares)))].sort(
    (a, b) => aliasNumber(a) - aliasNumber(b),
  )
  return {
    type: 'bar',
    data: {
      labels: labelsOf(history),
      datasets: aliases.map((alias) => {
        const style = pulqueriaStyle(alias)
        const named = [...history].reverse().find((entry) => alias in entry.shares)
        return {
          label: named?.shares[alias].display_name ?? alias,
          data: history.map((entry) => (alias in entry.shares ? entry.shares[alias].market_share : null)),
          backgroundColor: style.hatched ? hatched(style.color) : style.color,
        }
      }),
    },
    options: {
      scales: {
        x: { stacked: true, title: { display: true, text: 'Day' } },
        y: {
          stacked: true,
          min: 0,
          max: 1,
          title: { display: true, text: 'Share of units sold' },
          ticks: { callback: (value) => `${Math.round(Number(value) * 100)}%` },
        },
      },
    },
  }
}

/** Units sold and market demand by day, demand drawn last so it sits on top. */
export function buildDemandSoldConfig(history: PresentationDay[]): ChartConfiguration<'line'> {
  const sold = MEASURE_STYLES.sold
  const demand = MEASURE_STYLES.demand
  return {
    type: 'line',
    data: {
      labels: labelsOf(history),
      datasets: [
        {
          label: 'Units sold',
          data: history.map((entry) => entry.units_sold_total),
          borderColor: sold.color,
          backgroundColor: sold.color,
          borderDash: sold.dash,
          borderWidth: sold.width,
          pointRadius: 0,
        },
        {
          label: 'Market demand',
          data: history.map((entry) => entry.demand_total),
          borderColor: demand.color,
          backgroundColor: demand.color,
          borderDash: demand.dash,
          borderWidth: demand.width,
          pointRadius: 0,
        },
      ],
    },
    options: {
      scales: {
        x: { title: { display: true, text: 'Day' } },
        y: { title: { display: true, text: 'Units' } },
      },
    },
  }
}
