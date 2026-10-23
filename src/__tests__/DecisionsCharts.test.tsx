/**
 * Section 29 - block 5, Decisions (spec 13.8 block 5; design.md 3.3, 7.18).
 * Rendered through ResultsSummary (DecisionsCharts' props are not part of the Public surface).
 * Acceptance criteria 12, 13; failure mode 12 (chart side) and the peer-group rules of 3.2.
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
import type { ResultsView } from '../components/results/resultsView'
import { INITIAL_STATE, useGameStore } from '../store/gameStore'
import { DAYS, NAMES, makeView, withoutPeer } from './fixtures/results'
import { allCharts, chartInFigure, figureTitled } from './fixtures/resultsHelpers'

type Dict = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

beforeEach(() => {
  useGameStore.setState({ ...INITIAL_STATE })
})

function renderDecisions(view: ResultsView = makeView()) {
  return render(
    <MemoryRouter>
      <ResultsSummary view={view} viewer={{ isHost: false, myAlias: null }} showActions={false} hostSecret={null} />
    </MemoryRouter>,
  )
}

const norm = (a: unknown[]) => (a as number[]).map((v) => v + 0)
const sorted = (a: unknown[]) => [...(a as number[])].sort((x, y) => x - y)
const dataOf = (title: string) => chartInFigure(title).data.datasets.map((d) => norm(d.data as number[]))
const peerTitles = () =>
  screen
    .queryAllByText(/^Peer units per day: /)
    .map((el) => el.textContent as string)

describe('Cooperation votes', () => {
  it('plots days cooperated against days not cooperated, stacked', () => {
    renderDecisions()
    const chart = chartInFigure('Cooperation votes')
    expect(chart.type).toBe('bar')
    const stacked = Object.values(chart.options.scales ?? {}).some((s) => (s as Dict).stacked === true)
    expect(stacked).toBe(true)
    const series = dataOf('Cooperation votes').map(sorted)
    expect(series).toContainEqual([3, 10, 14])
    expect(series).toContainEqual([0, 4, 11])
  })

  it('takes the figures from the server fields, not from the per-day cooperate flags', () => {
    const view = makeView((s) => {
      s.players.P1.days_cooperated = 9
      s.players.P2.days_cooperated = 9
      s.players.P3.days_cooperated = 9
    })
    renderDecisions(view)
    const series = dataOf('Cooperation votes').map(sorted)
    expect(series).toContainEqual([9, 9, 9])
    expect(series).toContainEqual([5, 5, 5])
  })

  it('says how many days everyone agreed, from market.cooperation_reached', () => {
    renderDecisions()
    expect(screen.getByText('Everyone agreed on 6 days.')).toBeInTheDocument()
  })

  it('counts the days the market says, whatever the cooperators column says', () => {
    renderDecisions(
      makeView((s) => {
        ;(s.market.series as Dict).cooperation_reached = Array.from({ length: DAYS }, (_, i) => i < 2)
      }),
    )
    expect(screen.getByText('Everyone agreed on 2 days.')).toBeInTheDocument()
  })
})

describe('Insurance used', () => {
  it('plots the days under each insurance, stacked', () => {
    renderDecisions()
    const chart = chartInFigure('Insurance used')
    expect(chart.type).toBe('bar')
    expect(Object.values(chart.options.scales ?? {}).some((s) => (s as Dict).stacked === true)).toBe(true)
    const series = dataOf('Insurance used').map(sorted)
    expect(series).toContainEqual([1, 4, 5]) // exw
    expect(series).toContainEqual([0, 2, 5]) // cip
    expect(series).toContainEqual([2, 3, 6]) // dap
    expect(series).toContainEqual([2, 4, 8]) // ddp
  })
})

describe('Lots conserved', () => {
  it('plots lots_conserved per pulquería', () => {
    renderDecisions()
    const series = dataOf('Lots conserved').map(sorted)
    expect(series).toContainEqual([2, 4, 6])
  })
})

describe('Peer market (criterion 12, failure mode 12)', () => {
  it('has one chart per pulquería that traded, in rank order, and none for one that did not', () => {
    renderDecisions()
    expect(peerTitles()).toEqual([`Peer units per day: ${NAMES.P2}`, `Peer units per day: ${NAMES.P1}`])
    expect(screen.queryByText(`Peer units per day: ${NAMES.P3}`)).not.toBeInTheDocument()
    expect(screen.queryByText('No pulquería traded on the peer market.')).not.toBeInTheDocument()
  })

  it('plots Bought above zero and Sold below zero from the series', () => {
    renderDecisions()
    const chart = chartInFigure(`Peer units per day: ${NAMES.P1}`)
    const byLabel = Object.fromEntries(chart.data.datasets.map((d) => [d.label, norm(d.data as number[])]))
    expect(byLabel.Bought).toEqual([0, 0, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(byLabel.Sold).toEqual([0, -4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    for (const v of byLabel.Sold) expect(v).toBeLessThanOrEqual(0)
  })

  it('gives every chart of the group the same y range', () => {
    renderDecisions()
    const ys = [NAMES.P2, NAMES.P1].map((n) => chartInFigure(`Peer units per day: ${n}`).options.scales.y)
    for (const y of ys) expect(y).toMatchObject({ min: -16, max: 16 })
  })

  it('widens the shared range to the largest daily value of any pulquería, sold included', () => {
    renderDecisions(
      makeView((s) => {
        ;(s.players.P2.series as Dict).peer_sold = Array.from({ length: DAYS }, (_, i) => (i === 7 ? 20 : 0))
        s.players.P2.peer_units_sold = 20
      }),
    )
    for (const n of [NAMES.P2, NAMES.P1]) {
      expect(chartInFigure(`Peer units per day: ${n}`).options.scales.y).toMatchObject({ min: -20, max: 20 })
    }
  })

  it('has a table view with Day, Bought and Sold, sold as a positive count', () => {
    renderDecisions()
    const figure = figureTitled(`Peer units per day: ${NAMES.P1}`)
    fireEvent.click(within(figure).getByRole('button', { name: /Show table/ }))
    const table = within(figure).getByRole('table')
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent?.trim())).toEqual(['Day', 'Bought', 'Sold'])
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(DAYS)
    const cellsOfRow = (row: HTMLElement) => Array.from(row.querySelectorAll('th, td')).map((c) => c.textContent?.trim())
    expect(cellsOfRow(rows[1])).toEqual(['2', '0', '4'])
    expect(cellsOfRow(rows[2])).toEqual(['3', '16', '0'])
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

  it('failure mode 11: a payload without peer fields draws no peer chart', () => {
    renderDecisions(makeView(withoutPeer))
    expect(peerTitles()).toEqual([])
    const labels = allCharts().flatMap((c) => c.data.datasets.map((d) => d.label))
    expect(labels).not.toContain('Bought')
  })
})

describe('Spot price over the game', () => {
  it('is a full-width line of the market spot price with its two markers named', () => {
    renderDecisions()
    const figure = figureTitled('Spot price over the game')
    const chart = chartInFigure('Spot price over the game')
    expect(chart.type).toBe('line')
    const spot = (makeView().market.spot_price as number[]).map((v) => v + 0)
    expect(chart.data.datasets.map((d) => norm((d.data as unknown[]).filter((v) => v !== null) as number[]))).toContainEqual(spot)
    expect(within(figure).getAllByText('Refrigeration failure').length).toBeGreaterThan(0)
    expect(within(figure).getAllByText('Supplier disruption').length).toBeGreaterThan(0)
  })
})
