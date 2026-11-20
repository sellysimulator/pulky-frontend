/**
 * Block 5, Decisions (spec 13.8 block 5; design.md 3.3, 7.18).
 * Rendered through ResultsSummary (DecisionsCharts is not rendered on its own).
 * Covers the peer market charts and their peer groups.
 *
 * Every expected figure is read from the fixture view the test renders (`makeView()`, the
 * named shared input), or sits next to the override that produces it. Chart data is
 * asserted by dataset label and by pulquería, never by position in a sorted array.
 */
import { createElement, type ReactNode } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-chartjs-2', () => {
  const make = (type: string) => (props: { data?: unknown; options?: unknown }) =>
    createElement('div', {
      'data-testid': `chart-${type}`,
      'data-chart': JSON.stringify({ type, data: props.data, options: props.options }),
    })
  return { Bar: make('bar'), Line: make('line'), Pie: make('pie'), Doughnut: make('doughnut') }
})

vi.mock('../../firebase', () => ({ auth: { currentUser: null }, googleProvider: {}, app: {} }))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    loading: false,
    mode: 'authenticated',
    user: null,
    signInWithGoogle: async () => undefined,
    continueAsGuest: () => undefined,
    signOut: async () => undefined,
  }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

import ResultsSummary from '../components/results/ResultsSummary'
import type { PulqueriaResultView, ResultsView } from '../components/results/resultsView'
import { INITIAL_STATE, useGameStore } from '../store/gameStore'
import { INCOTERM_TIERS } from '../types/game'
import { INCOTERM_TIER_NAMES } from '../utils/format'
import { DAYS, NAMES, PEAK_DAYS, RANK_ORDER, makeView, withoutPeer } from './fixtures/results'
import { allCharts, chartInFigure, figureTitled, type ParsedChart } from './fixtures/resultsHelpers'

type Dict = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

beforeEach(() => {
  useGameStore.setState({ ...INITIAL_STATE })
})

function renderDecisions(view: ResultsView = makeView()) {
  return render(
    <MemoryRouter>
      <ResultsSummary view={view} viewer={{ isHost: false, myAlias: null }} showActions={false} />
    </MemoryRouter>,
  )
}

/** `v + 0` turns a -0 into 0, so `toEqual` does not tell them apart. */
const norm = (a: unknown[]) => (a as number[]).map((v) => v + 0)
/** The chart's datasets keyed by their label. */
const datasetsByLabel = (chart: ParsedChart): Record<string, unknown[]> =>
  Object.fromEntries(chart.data.datasets.map((d) => [d.label as string, d.data as unknown[]]))
/** One dataset of a per-pulquería bar chart, keyed by the bar's label (the display name). */
const perPulqueria = (chart: ParsedChart, label: string): Record<string, number> => {
  const values = datasetsByLabel(chart)[label]
  if (!values) throw new Error(`no dataset "${label}"`)
  return Object.fromEntries((chart.data.labels as string[]).map((name, i) => [name, (values[i] as number) + 0]))
}
/** The fixture's figure for each pulquería, keyed by display name. */
const expectedPer = (view: ResultsView, pick: (p: PulqueriaResultView) => number): Record<string, number> =>
  Object.fromEntries(view.players.map((p) => [p.display_name, pick(p)]))
const rankOrderNames = () => RANK_ORDER.map((alias) => NAMES[alias])
const playerOf = (view: ResultsView, alias: string) => {
  const p = view.players.find((x) => x.alias === alias)
  if (!p) throw new Error(`no player ${alias}`)
  return p
}
const peerTitle = (name: string) => `Peer units per day: ${name}`
const peerTitles = () =>
  screen
    .queryAllByText(/^Peer units per day: /)
    .map((el) => el.textContent as string)

describe('Cooperation votes', () => {
  it('plots days cooperated against days not cooperated, stacked', () => {
    const view = makeView()
    renderDecisions(view)
    const chart = chartInFigure('Cooperation votes')
    expect(chart.type).toBe('bar')
    const stacked = Object.values(chart.options.scales ?? {}).some((s) => (s as Dict).stacked === true)
    expect(stacked).toBe(true)
    expect(chart.data.labels).toEqual(rankOrderNames())

    const yes = perPulqueria(chart, 'Cooperated')
    const no = perPulqueria(chart, 'Did not cooperate')
    expect(yes).toEqual(expectedPer(view, (p) => p.days_cooperated))
    expect(no).toEqual(expectedPer(view, (p) => view.days_played - p.days_cooperated))
    // The two stacks of a bar always cover every day played.
    for (const name of rankOrderNames()) expect(yes[name] + no[name]).toBe(view.days_played)
    // Hand-checked against the fixture (P1 cooperated 3 of 14 days), so a wrong subtraction
    // cannot hide behind a derivation that makes the same mistake.
    expect(no[NAMES.P1]).toBe(11)
  })

  it('takes the figures from the server fields, not from the per-day cooperate flags', () => {
    const COOPERATED = 9
    const view = makeView((s) => {
      s.players.P1.days_cooperated = COOPERATED
      s.players.P2.days_cooperated = COOPERATED
      s.players.P3.days_cooperated = COOPERATED
    })
    // The override must differ from what the flags count, or the test proves nothing.
    for (const p of view.players) expect(p.series.cooperate.filter(Boolean).length).not.toBe(COOPERATED)
    renderDecisions(view)
    const chart = chartInFigure('Cooperation votes')
    const every = (n: number) => Object.fromEntries(rankOrderNames().map((name) => [name, n]))
    expect(perPulqueria(chart, 'Cooperated')).toEqual(every(COOPERATED))
    expect(perPulqueria(chart, 'Did not cooperate')).toEqual(every(DAYS - COOPERATED))
  })

  it('says how many days everyone agreed, from market.cooperation_reached', () => {
    // The fixture sets cooperation_reached on exactly the PEAK_DAYS.
    renderDecisions()
    expect(screen.getByText(`Everyone agreed on ${PEAK_DAYS.length} days.`)).toBeInTheDocument()
  })

  it('counts the days the market says, whatever the cooperators column says', () => {
    const AGREED_DAYS = 2
    const view = makeView((s) => {
      ;(s.market.series as Dict).cooperation_reached = Array.from({ length: DAYS }, (_, i) => i < AGREED_DAYS)
    })
    // The cooperators column still says all three agreed on more days than that.
    const allThree = (view.market as unknown as { cooperators: number[] }).cooperators.filter((n) => n === RANK_ORDER.length)
    expect(allThree.length).not.toBe(AGREED_DAYS)
    renderDecisions(view)
    expect(screen.getByText(`Everyone agreed on ${AGREED_DAYS} days.`)).toBeInTheDocument()
  })
})

describe('Insurance used', () => {
  it('plots the days under each insurance, stacked', () => {
    const view = makeView()
    renderDecisions(view)
    const chart = chartInFigure('Insurance used')
    expect(chart.type).toBe('bar')
    expect(Object.values(chart.options.scales ?? {}).some((s) => (s as Dict).stacked === true)).toBe(true)
    expect(chart.data.labels).toEqual(rankOrderNames())
    expect(chart.data.datasets.map((d) => d.label)).toEqual(INCOTERM_TIERS.map((t) => INCOTERM_TIER_NAMES[t]))

    for (const tier of INCOTERM_TIERS) {
      expect(perPulqueria(chart, INCOTERM_TIER_NAMES[tier])).toEqual(expectedPer(view, (p) => p.incoterm_tier_days[tier]))
    }
    // Every day played was shipped under one insurance in the fixture, so each bar spans the game.
    for (const name of rankOrderNames()) {
      const total = INCOTERM_TIERS.reduce((sum, tier) => sum + perPulqueria(chart, INCOTERM_TIER_NAMES[tier])[name], 0)
      expect(total).toBe(view.days_played)
    }
  })
})

describe('Lots conserved', () => {
  it('plots lots_conserved per pulquería', () => {
    const view = makeView()
    renderDecisions(view)
    const chart = chartInFigure('Lots conserved')
    expect(chart.data.labels).toEqual(rankOrderNames())
    expect(perPulqueria(chart, 'Lots conserved')).toEqual(expectedPer(view, (p) => p.lots_conserved))
  })
})

describe('Peer market', () => {
  /** Pulquerías with a non-zero peer day in their series, in rank order: read from the series, not the totals. */
  const tradersOf = (view: ResultsView) =>
    view.players.filter((p) => [...(p.series.peer_bought ?? []), ...(p.series.peer_sold ?? [])].some((v) => v !== 0))
  /** The largest daily peer value of any pulquería, bought or sold. */
  const largestDay = (view: ResultsView) =>
    view.players.reduce(
      (top, p) => [...(p.series.peer_bought ?? []), ...(p.series.peer_sold ?? [])].reduce((a, v) => (v > a ? v : a), top),
      0,
    )

  it('has one chart per pulquería that traded, in rank order, and none for one that did not', () => {
    const view = makeView()
    renderDecisions(view)
    const traders = tradersOf(view)
    expect(peerTitles()).toEqual(traders.map((p) => peerTitle(p.display_name)))
    const idle = view.players.filter((p) => !traders.includes(p))
    expect(idle.length).toBeGreaterThan(0)
    for (const p of idle) expect(screen.queryByText(peerTitle(p.display_name))).not.toBeInTheDocument()
    expect(screen.queryByText('No pulquería traded on the peer market.')).not.toBeInTheDocument()
  })

  it('plots Bought above zero and Sold below zero from the series', () => {
    const view = makeView()
    renderDecisions(view)
    for (const p of tradersOf(view)) {
      const chart = chartInFigure(peerTitle(p.display_name))
      expect(chart.data.labels).toEqual(Array.from({ length: view.days_played }, (_, i) => String(i + 1)))
      const byLabel = datasetsByLabel(chart)
      expect(norm(byLabel.Bought)).toEqual(p.series.peer_bought)
      expect(norm(byLabel.Sold)).toEqual((p.series.peer_sold ?? []).map((v) => 0 - v))
      for (const v of byLabel.Bought as number[]) expect(v).toBeGreaterThanOrEqual(0)
      for (const v of byLabel.Sold as number[]) expect(v).toBeLessThanOrEqual(0)
    }
    // Hand-checked against the fixture (P1 sold 4 units on day 2), so the sign is pinned even if
    // the derivation above and the chart flipped it together.
    expect(datasetsByLabel(chartInFigure(peerTitle(NAMES.P1))).Sold[1]).toBe(-4)
  })

  it('gives every chart of the group the same y range', () => {
    const view = makeView()
    const limit = largestDay(view)
    // The range must be shared, not each chart's own: some trader's own largest day is smaller.
    const ownLargest = (p: PulqueriaResultView) => largestDay({ ...view, players: [p] })
    expect(tradersOf(view).some((p) => ownLargest(p) < limit)).toBe(true)
    renderDecisions(view)
    for (const p of tradersOf(view)) {
      expect(chartInFigure(peerTitle(p.display_name)).options.scales.y).toMatchObject({ min: -limit, max: limit })
    }
  })

  it('widens the shared range to the largest daily value of any pulquería, sold included', () => {
    const SOLD_ON_DAY_8 = 20
    expect(SOLD_ON_DAY_8).toBeGreaterThan(largestDay(makeView()))
    const view = makeView((s) => {
      ;(s.players.P2.series as Dict).peer_sold = Array.from({ length: DAYS }, (_, i) => (i === 7 ? SOLD_ON_DAY_8 : 0))
      s.players.P2.peer_units_sold = SOLD_ON_DAY_8
    })
    renderDecisions(view)
    for (const p of tradersOf(view)) {
      expect(chartInFigure(peerTitle(p.display_name)).options.scales.y).toMatchObject({ min: -SOLD_ON_DAY_8, max: SOLD_ON_DAY_8 })
    }
  })

  it('has a table view with Day, Bought and Sold, sold as a positive count', () => {
    const view = makeView()
    const p1 = playerOf(view, 'P1')
    renderDecisions(view)
    const figure = figureTitled(peerTitle(p1.display_name))
    fireEvent.click(within(figure).getByRole('button', { name: /Show table/ }))
    const table = within(figure).getByRole('table')
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent?.trim())).toEqual(['Day', 'Bought', 'Sold'])
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(view.days_played)
    const cellsOfRow = (row: HTMLElement) => Array.from(row.querySelectorAll('th, td')).map((c) => c.textContent?.trim())
    const bought = p1.series.peer_bought ?? []
    const sold = p1.series.peer_sold ?? []
    // The fixture's peer figures are small whole numbers, so their plain String() is how they read.
    expect(rows.map(cellsOfRow)).toEqual(rows.map((_, i) => [String(i + 1), String(bought[i]), String(sold[i])]))
    expect(sold.some((v) => v > 0)).toBe(true)
  })

  it('says so when no pulquería traded, and draws no peer chart', () => {
    renderDecisions(
      makeView((s) => {
        for (const p of Object.values(s.players)) {
          p.peer_units_bought = 0
          p.peer_units_sold = 0
          const series = p.series as Dict
          series.peer_bought = Array.from({ length: DAYS }, () => 0)
          series.peer_sold = Array.from({ length: DAYS }, () => 0)
        }
      }),
    )
    expect(screen.getByText('No pulquería traded on the peer market.')).toBeInTheDocument()
    expect(peerTitles()).toEqual([])
  })

  it('a payload without peer fields draws no peer chart', () => {
    renderDecisions(makeView(withoutPeer))
    expect(peerTitles()).toEqual([])
    const labels = allCharts().flatMap((c) => c.data.datasets.map((d) => d.label))
    expect(labels).not.toContain('Bought')
  })
})

describe('Spot price over the game', () => {
  it('is a full-width line of the market spot price with its two markers named', () => {
    const view = makeView()
    renderDecisions(view)
    const figure = figureTitled('Spot price over the game')
    const chart = chartInFigure('Spot price over the game')
    expect(chart.type).toBe('line')
    const m = view.market
    const byLabel = datasetsByLabel(chart)
    expect(byLabel['Spot price']).toEqual(m.spot_price)
    // A marker sits on the spot price of each flagged day and is absent (null) on the others.
    const markedOn = (flags: boolean[]) => m.spot_price.map((v, i) => (flags[i] ? v : null))
    expect(byLabel['Refrigeration failure']).toEqual(markedOn(m.refrigeration_failure))
    expect(byLabel['Supplier disruption']).toEqual(markedOn(m.disrupted))
    expect(m.refrigeration_failure.some(Boolean) && m.disrupted.some(Boolean)).toBe(true)
    expect(within(figure).getAllByText('Refrigeration failure').length).toBeGreaterThan(0)
    expect(within(figure).getAllByText('Supplier disruption').length).toBeGreaterThan(0)
  })
})
