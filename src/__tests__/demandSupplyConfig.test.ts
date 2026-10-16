/**
 * Section 29 - demandSupplyConfig.ts (spec 13.8 blocks 2, 3 and 5; design.md 3.3, 9.1, 9.3).
 * Acceptance criteria 5, 12, 13; failure modes 5, 10, 11, 12.
 */
import { describe, expect, it } from 'vitest'
import {
  DEMAND_SUPPLY_LEGEND_ORDER,
  buildDemandSupplyConfig,
  buildPeerUnitsConfig,
  buildWherePulqueWentConfig,
  type DemandSupplySeries,
} from '../components/results/demandSupplyConfig'
import { MEASURE_STYLES } from '../components/charts/chartSetup'
import { weekdayShort } from '../utils/format'
import type { Weekday } from '../types/game'
import { DAYS, PEAK_DAYS, RANK_ORDER, makeView, withoutPeer } from './fixtures/results'

type Dict = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const view = () => makeView()
const labelsOf = (cfg: { data: { datasets: Array<{ label?: string }> } }) => cfg.data.datasets.map((d) => d.label)
const norm = (a: unknown[]) => (a as number[]).map((v) => v + 0) // -0 becomes 0

/** Every `font` object anywhere in the config. */
function fontObjects(node: unknown, found: Dict[] = []): Dict[] {
  if (Array.isArray(node)) node.forEach((n) => fontObjects(n, found))
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'font' && v && typeof v === 'object') found.push(v as Dict)
      fontObjects(v, found)
    }
  }
  return found
}

describe('DEMAND_SUPPLY_LEGEND_ORDER', () => {
  it('is demand first, then delivered, sold, spoiled, backlog', () => {
    expect(DEMAND_SUPPLY_LEGEND_ORDER).toEqual(['demand', 'delivered', 'sold', 'spoiled', 'backlog'])
  })
})

describe('buildDemandSupplyConfig (criterion 5)', () => {
  it('is a line chart', () => {
    expect(buildDemandSupplyConfig(view(), DEMAND_SUPPLY_LEGEND_ORDER).type).toBe('line')
  })

  it('draws demand last, after delivered, sold, spoiled and backlog (failure mode 5)', () => {
    const cfg = buildDemandSupplyConfig(view(), DEMAND_SUPPLY_LEGEND_ORDER)
    expect(labelsOf(cfg)).toEqual(['Pulque delivered', 'Units sold', 'Units spoiled', 'Backlog at day end', 'Market demand'])
    expect(cfg.data.datasets.at(-1)!.label).toBe('Market demand')
  })

  it('keeps demand last whatever order the visible list is in', () => {
    const cfg = buildDemandSupplyConfig(view(), ['demand', 'backlog', 'delivered'])
    expect(labelsOf(cfg)).toEqual(['Pulque delivered', 'Backlog at day end', 'Market demand'])
  })

  it('hiding a series removes its dataset', () => {
    expect(buildDemandSupplyConfig(view(), ['demand', 'sold']).data.datasets).toHaveLength(2)
    expect(labelsOf(buildDemandSupplyConfig(view(), ['demand', 'sold']))).toEqual(['Units sold', 'Market demand'])
    expect(labelsOf(buildDemandSupplyConfig(view(), ['spoiled']))).toEqual(['Units spoiled'])
    expect(buildDemandSupplyConfig(view(), []).data.datasets).toHaveLength(0)
  })

  it('plots the market series as sent, one value per day', () => {
    const v = view()
    const cfg = buildDemandSupplyConfig(v, DEMAND_SUPPLY_LEGEND_ORDER)
    const byLabel = Object.fromEntries(cfg.data.datasets.map((d) => [d.label, d.data]))
    expect(byLabel['Market demand']).toEqual(v.market.demand)
    expect(byLabel['Pulque delivered']).toEqual(v.market.delivered)
    expect(byLabel['Units sold']).toEqual(v.market.sold)
    expect(byLabel['Units spoiled']).toEqual(v.market.spoiled)
    expect(byLabel['Backlog at day end']).toEqual(v.market.backlog_end)
  })

  it('labels each day with a two-line tick: the day number, then the weekday', () => {
    const v = view()
    const labels = buildDemandSupplyConfig(v, DEMAND_SUPPLY_LEGEND_ORDER).data.labels as unknown[]
    expect(labels).toHaveLength(DAYS)
    expect(labels[0]).toEqual(['1', 'Mon'])
    expect(labels[3]).toEqual(['4', 'Thu'])
    expect(labels[13]).toEqual(['14', 'Sun'])
    labels.forEach((l, i) => expect(l).toEqual([String(i + 1), weekdayShort(v.market.weekday[i] as Weekday)]))
  })

  it('uses days 1..days_played for the axis when the game ended early', () => {
    const v = makeView((s) => {
      s.market.series = Object.fromEntries(
        Object.entries(s.market.series as Dict).map(([k, arr]) => [k, (arr as unknown[]).slice(0, 5)]),
      )
    })
    v.days_played = 5
    v.ended_early = true
    const cfg = buildDemandSupplyConfig(v, DEMAND_SUPPLY_LEGEND_ORDER)
    expect((cfg.data.labels as unknown[]).map((l) => (l as string[])[0])).toEqual(['1', '2', '3', '4', '5'])
    cfg.data.datasets.forEach((d) => expect(d.data).toHaveLength(5))
  })

  it('draws demand undashed at the demand width, the only undashed and only widest line', () => {
    const cfg = buildDemandSupplyConfig(view(), DEMAND_SUPPLY_LEGEND_ORDER)
    const demand = cfg.data.datasets.find((d) => d.label === 'Market demand') as Dict
    expect(demand.borderWidth).toBe(MEASURE_STYLES.demand.width)
    expect(demand.borderWidth).toBe(4)
    expect(demand.borderColor).toBe(MEASURE_STYLES.demand.color)
    expect(!demand.borderDash || demand.borderDash.length === 0).toBe(true)
    for (const d of cfg.data.datasets.filter((x) => x.label !== 'Market demand') as Dict[]) {
      expect(Array.isArray(d.borderDash) && d.borderDash.length > 0, `${d.label} is dashed`).toBe(true)
      expect(d.borderWidth, `${d.label} is thinner than demand`).toBeLessThan(4)
    }
  })

  it('gives every other series its MEASURE_STYLES dash and colour', () => {
    const cfg = buildDemandSupplyConfig(view(), DEMAND_SUPPLY_LEGEND_ORDER)
    const expected: Record<string, DemandSupplySeries> = {
      'Pulque delivered': 'delivered',
      'Units sold': 'sold',
      'Units spoiled': 'spoiled',
      'Backlog at day end': 'backlog',
    }
    for (const [label, key] of Object.entries(expected)) {
      const d = cfg.data.datasets.find((x) => x.label === label) as Dict
      expect(d.borderDash, label).toEqual(MEASURE_STYLES[key].dash)
      expect(d.borderColor, label).toBe(MEASURE_STYLES[key].color)
    }
  })

  it('distinguishes the series by both dash pattern and colour (no two alike)', () => {
    const cfg = buildDemandSupplyConfig(view(), DEMAND_SUPPLY_LEGEND_ORDER)
    const dashes = cfg.data.datasets.map((d) => JSON.stringify((d as Dict).borderDash ?? []))
    const colours = cfg.data.datasets.map((d) => (d as Dict).borderColor)
    expect(new Set(dashes).size).toBe(dashes.length)
    expect(new Set(colours).size).toBe(colours.length)
  })

  it('has one y axis that starts at zero', () => {
    const cfg = buildDemandSupplyConfig(view(), DEMAND_SUPPLY_LEGEND_ORDER)
    const scales = (cfg.options?.scales ?? {}) as Dict
    const yAxes = Object.keys(scales).filter((k) => k.startsWith('y'))
    expect(yAxes).toHaveLength(1)
    expect(scales[yAxes[0]].beginAtZero).toBe(true)
    for (const d of cfg.data.datasets as Dict[]) {
      expect([undefined, yAxes[0]]).toContain(d.yAxisID)
    }
  })

  it('lists the peak days as the indices where the weekday multiplier is 1', () => {
    const cfg = buildDemandSupplyConfig(view(), DEMAND_SUPPLY_LEGEND_ORDER)
    expect((cfg.options as Dict).plugins.peakShading.days).toEqual(PEAK_DAYS)
  })

  it('follows the multipliers it is given, not the weekday names', () => {
    const v = makeView((s) => {
      const series = s.market.series as Dict
      series.weekday_multiplier = (series.weekday_multiplier as number[]).map((_, i) => (i < 2 ? 1 : 0.5))
    })
    expect((buildDemandSupplyConfig(v, ['demand']).options as Dict).plugins.peakShading.days).toEqual([0, 1])
  })

  it('lists the peak days whichever series are visible', () => {
    expect((buildDemandSupplyConfig(view(), ['sold']).options as Dict).plugins.peakShading.days).toEqual(PEAK_DAYS)
  })

  it('never sets a font size', () => {
    const cfg = buildDemandSupplyConfig(view(), DEMAND_SUPPLY_LEGEND_ORDER)
    for (const font of fontObjects(cfg)) expect(font).not.toHaveProperty('size')
  })

  it('returns a new config every call and leaves the view alone', () => {
    const v = view()
    const before = structuredClone(v)
    const first = buildDemandSupplyConfig(v, DEMAND_SUPPLY_LEGEND_ORDER)
    const second = buildDemandSupplyConfig(v, ['demand'])
    expect(first).not.toBe(second)
    expect(first.data.datasets).toHaveLength(5)
    expect(second.data.datasets).toHaveLength(1)
    expect(v).toEqual(before)
  })
})

describe('buildWherePulqueWentConfig (criterion 12, failure modes 10 and 11)', () => {
  it('is a horizontal stacked bar chart', () => {
    const cfg = buildWherePulqueWentConfig(view()) as Dict
    expect(cfg.type).toBe('bar')
    expect(cfg.options.indexAxis).toBe('y')
    expect(cfg.options.scales.x.stacked).toBe(true)
    expect(cfg.options.scales.y.stacked).toBe(true)
  })

  it('stacks Sold, Sold to pulquerías, Spoiled, Lost in transit, Liquidated at the end, in that order', () => {
    expect(labelsOf(buildWherePulqueWentConfig(view()))).toEqual([
      'Sold',
      'Sold to pulquerías',
      'Spoiled',
      'Lost in transit',
      'Liquidated at the end',
    ])
  })

  it('has one bar per pulquería in rank order', () => {
    const v = view()
    const cfg = buildWherePulqueWentConfig(v)
    const labels = cfg.data.labels as string[]
    expect(labels).toHaveLength(3)
    labels.forEach((l, i) => expect([v.players[i].display_name, v.players[i].alias]).toContain(l))
  })

  it('plots each dataset from its own field, in rank order', () => {
    const v = view()
    const byLabel = Object.fromEntries(buildWherePulqueWentConfig(v).data.datasets.map((d) => [d.label, d.data]))
    expect(byLabel['Sold']).toEqual(v.players.map((p) => p.units_sold))
    expect(byLabel['Sold to pulquerías']).toEqual(v.players.map((p) => p.peer_units_sold))
    expect(byLabel['Spoiled']).toEqual(v.players.map((p) => p.units_spoiled))
    expect(byLabel['Lost in transit']).toEqual(v.players.map((p) => p.units_lost_transport))
    expect(byLabel['Liquidated at the end']).toEqual(v.players.map((p) => p.liquidated_units))
  })

  it('failure mode 10: Sold carries units_sold only, not units_sold + peer_units_sold', () => {
    const v = view()
    const sold = buildWherePulqueWentConfig(v).data.datasets.find((d) => d.label === 'Sold')!
    expect(v.players.some((p) => (p.peer_units_sold ?? 0) > 0)).toBe(true)
    expect(sold.data).toEqual([520, 300, 410])
  })

  it('draws Sold to pulquerías differently from Sold (hatched, not the plain fill)', () => {
    const [sold, peer] = buildWherePulqueWentConfig(view()).data.datasets as Dict[]
    expect(peer.backgroundColor).toBeDefined()
    expect(peer.backgroundColor).not.toEqual(sold.backgroundColor)
  })

  it('failure mode 11: without peer_units_sold there is no Sold to pulquerías dataset', () => {
    const v = makeView(withoutPeer)
    const labels = labelsOf(buildWherePulqueWentConfig(v))
    expect(labels).not.toContain('Sold to pulquerías')
    expect(labels).toEqual(['Sold', 'Spoiled', 'Lost in transit', 'Liquidated at the end'])
  })
})

describe('buildPeerUnitsConfig (criterion 12, failure mode 12)', () => {
  const p1 = () => buildPeerUnitsConfig(view(), 'P1')

  it('is a bar chart with a Bought and a Sold dataset', () => {
    expect(p1().type).toBe('bar')
    expect(labelsOf(p1())).toEqual(['Bought', 'Sold'])
  })

  it('plots bought above zero and sold as negative values', () => {
    const [bought, sold] = p1().data.datasets
    expect(norm(bought.data)).toEqual([0, 0, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(norm(sold.data)).toEqual([0, -4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  })

  it('failure mode 12: every Sold value is at or below zero, for every pulquería', () => {
    for (const alias of RANK_ORDER) {
      const sold = buildPeerUnitsConfig(view(), alias).data.datasets.find((d) => d.label === 'Sold')!
      for (const value of sold.data as number[]) expect(value).toBeLessThanOrEqual(0)
    }
    const sold = p1().data.datasets.find((d) => d.label === 'Sold')!
    expect((sold.data as number[]).some((v) => v < 0)).toBe(true)
  })

  it('has one value per day 1..days_played and day labels', () => {
    const cfg = p1()
    expect(cfg.data.labels).toHaveLength(DAYS)
    expect((cfg.data.labels as unknown[]).map(String).slice(0, 3)).toEqual(['1', '2', '3'])
    cfg.data.datasets.forEach((d) => expect(d.data).toHaveLength(DAYS))
  })

  it('shares one y range of plus and minus the largest daily value of any pulquería', () => {
    const y1 = (p1().options as Dict).scales.y
    expect(y1).toMatchObject({ min: -16, max: 16 })
    const y2 = (buildPeerUnitsConfig(view(), 'P2').options as Dict).scales.y
    expect(y2).toMatchObject({ min: -16, max: 16 })
    const y3 = (buildPeerUnitsConfig(view(), 'P3').options as Dict).scales.y
    expect(y3).toMatchObject({ min: -16, max: 16 })
  })

  it('counts a large sold value of another pulquería in the shared range', () => {
    const v = makeView((s) => {
      ;(s.players.P2.series as Dict).peer_sold = Array.from({ length: DAYS }, (_, i) => (i === 7 ? 20 : 0))
      s.players.P2.peer_units_sold = 20
    })
    for (const alias of ['P1', 'P2']) {
      expect((buildPeerUnitsConfig(v, alias).options as Dict).scales.y, alias).toMatchObject({ min: -20, max: 20 })
    }
    const sold = buildPeerUnitsConfig(v, 'P2').data.datasets.find((d) => d.label === 'Sold')!
    expect(norm(sold.data)[7]).toBe(-20)
  })

  it('does not change the view', () => {
    const v = view()
    const before = structuredClone(v)
    buildPeerUnitsConfig(v, 'P1')
    expect(v).toEqual(before)
  })
})
