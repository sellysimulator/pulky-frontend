/**
 * Section 29 - ResultsSummary: the six blocks (spec 13.8; design.md 7.18, 8.8, 9.2, 9.3).
 * Acceptance criteria 1, 3, 4, 6, 8 (claim conditions), 10, 11, 12, 13; failure modes 3, 4, 7, 10, 11.
 * The ratio table and the Decisions block have their own files (RatioTable, DecisionsCharts).
 */
import { createElement, useEffect, type ReactNode } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** The plot area a laid-out chart reports to its plugins: 240px tall, 6px above the plot, 50px of axis below it. */
const LAID_OUT = { chartArea: { top: 6, bottom: 190 }, height: 240 }

vi.mock('react-chartjs-2', () => {
  type Props = { data?: unknown; options?: unknown; plugins?: Array<{ afterLayout?(chart: unknown): void }> }
  const make = (type: string) =>
    function MockChart(props: Props) {
      // jsdom has no canvas, so the mock plays the one hook a layout-reading plugin needs.
      useEffect(() => {
        for (const plugin of props.plugins ?? []) plugin.afterLayout?.(LAID_OUT)
      })
      return createElement('div', {
        'data-testid': `chart-${type}`,
        'data-chart': JSON.stringify({ type, data: props.data, options: props.options }),
      })
    }
  return { Bar: make('bar'), Line: make('line'), Pie: make('pie'), Doughnut: make('doughnut') }
})

vi.mock('../../firebase', () => ({ auth: { currentUser: null }, googleProvider: {}, app: {} }))

const auth = vi.hoisted(() => ({
  mode: 'authenticated' as 'authenticated' | 'guest' | null,
  signIn: vi.fn(async () => undefined),
}))
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    loading: false,
    mode: auth.mode,
    user: null,
    signInWithGoogle: auth.signIn,
    continueAsGuest: () => undefined,
    signOut: async () => undefined,
  }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

import ResultsSummary from '../components/results/ResultsSummary'
import { DEMAND_SUPPLY_LEGEND_ORDER } from '../components/results/demandSupplyConfig'
import type { ResultsView } from '../components/results/resultsView'
import { INITIAL_STATE, useGameStore } from '../store/gameStore'
import { formatMoney } from '../utils/format'
import { getHostSecret, getOrCreateGuestId, markGamePlayed, setSessionToken } from '../utils/storage'
import { GAME_ID, NAMES, PEAK_DAYS, ROOM, makeView, withoutPeer } from './fixtures/results'
import {
  chartWithDataset,
  figureTitled,
  hasClassAncestor,
  header,
  jsonBody,
  mockHttp,
  numbersAfter,
  onScreen,
  ownersOf,
  urlPath,
  verb,
  type HttpSpy,
} from './fixtures/resultsHelpers'

const CHART_TITLE = 'Market demand vs pulque delivered, sold and spoiled'
const SWITCH_LABELS = ['Market demand', 'Pulque delivered', 'Units sold', 'Units spoiled', 'Backlog at day end']
const PROFITS = [formatMoney(5123.45), formatMoney(3000.5), formatMoney(-250.75)]

const FULL_CONFIG = {
  random_seed: 424242,
  demand: { retail_price: 30, weekday_peak: { from: 'thu', to: 'sat' } },
  supplier: { base_price: 12, quality_min: 80, quality_max: 100 },
  stock: { conservation_extra_fresh_days: 2, conservation_cost_per_unit: 1 },
  peer_market: { enabled: true },
  transport: { unit_cost: 1 },
}

const HOST = { isHost: true, myAlias: null }
const PLAYER = { isHost: false, myAlias: 'P1' }

interface Opts {
  view?: ResultsView
  viewer?: { isHost: boolean; myAlias: string | null }
  showActions?: boolean
  hostSecret?: string | null
}

function renderSummary({ view = makeView(), viewer = HOST, showActions = true, hostSecret = 'sec-1' }: Opts = {}) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <ResultsSummary view={view} viewer={viewer} showActions={showActions} hostSecret={hostSecret} /> },
      { path: '/host/:code', element: <p>host page</p> },
    ],
    { initialEntries: ['/'] },
  )
  const utils = render(<RouterProvider router={router} />)
  return { router, ...utils }
}

let spy: HttpSpy | null = null
beforeEach(() => {
  useGameStore.setState({ ...INITIAL_STATE })
  auth.mode = 'authenticated'
  auth.signIn.mockImplementation(async () => undefined)
})
afterEach(() => {
  vi.restoreAllMocks()
  spy?.restore()
  spy = null
})

const before = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('the six blocks (criterion 1)', () => {
  it('renders the blocks in spec order: leaderboard, chart, where it went, ratios, decisions, actions', () => {
    renderSummary()
    const anchors = [
      screen.getByRole('button', { name: 'Reveal' }),
      screen.getByText(CHART_TITLE),
      chartWithDataset('Sold to pulquerías')!.element,
      screen.getByRole('table', { name: 'Ratios' }),
      screen.getByText('Cooperation votes'),
      screen.getByRole('button', { name: 'Export CSV' }),
    ]
    for (let i = 1; i < anchors.length; i++) {
      expect(before(anchors[i - 1], anchors[i]), `block ${i} comes before block ${i + 1}`).toBe(true)
    }
  })

  it('numbers the blocks 1 to 6 in their titles', () => {
    renderSummary()
    const numbers = screen
      .getAllByRole('heading')
      .map((h) => /^\s*([1-6])(?!\d)/.exec(h.textContent ?? '')?.[1])
      .filter(Boolean)
    expect(numbers).toEqual(['1', '2', '3', '4', '5', '6'])
  })

  it('criterion 11: with showActions false it renders blocks 1 to 5 only', () => {
    renderSummary({ showActions: false })
    const numbers = screen
      .getAllByRole('heading')
      .map((h) => /^\s*([1-6])(?!\d)/.exec(h.textContent ?? '')?.[1])
      .filter(Boolean)
    expect(numbers).toEqual(['1', '2', '3', '4', '5'])
    expect(screen.getByRole('table', { name: 'Ratios' })).toBeInTheDocument()
    expect(screen.getByText('Cooperation votes')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Export JSON' })).not.toBeInTheDocument()
    expect(screen.queryByText('Debrief notes')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Play again' })).not.toBeInTheDocument()
  })

  it('shows no claim prompt with showActions false even when every condition holds', () => {
    auth.mode = 'guest'
    markGamePlayed(GAME_ID)
    getOrCreateGuestId()
    renderSummary({ viewer: PLAYER, showActions: false, hostSecret: null })
    expect(screen.queryByText('Sign in to keep these results in your profile.')).not.toBeInTheDocument()
  })
})

describe('block 1 inside the summary (criterion 4, failure modes 3 and 4)', () => {
  it('hides every profit from the host until Reveal is pressed', () => {
    renderSummary({ viewer: HOST })
    for (const text of PROFITS) expect(onScreen(text), text).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Reveal' }))
    for (const text of PROFITS) expect(onScreen(text).length, text).toBeGreaterThan(0)
  })

  it('shows every profit to a player on the first render', () => {
    renderSummary({ viewer: PLAYER, hostSecret: null })
    for (const text of PROFITS) expect(onScreen(text).length, text).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Reveal' })).not.toBeInTheDocument()
  })

  it('marks the viewer\'s own pulquería with You', () => {
    renderSummary({ viewer: PLAYER, hostSecret: null })
    const chips = onScreen('You')
    expect(chips.length).toBeGreaterThan(0)
    for (const chip of chips) expect(ownersOf(chip, Object.values(NAMES))).toEqual([NAMES.P1])
  })
})

describe('block 2: demand vs supply (criteria 5 and 6)', () => {
  it('titles the chart and plots buildDemandSupplyConfig, demand last', () => {
    renderSummary()
    expect(screen.getByText(CHART_TITLE)).toBeInTheDocument()
    const chart = chartWithDataset('Market demand')!
    expect(chart.type).toBe('line')
    expect(chart.data.datasets.map((d) => d.label)).toEqual([
      'Pulque delivered',
      'Units sold',
      'Units spoiled',
      'Backlog at day end',
      'Market demand',
    ])
    expect(chart.options.plugins.peakShading.days).toEqual(PEAK_DAYS)
  })

  it('has one switch per series in legend order, all on at first', () => {
    renderSummary()
    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(DEMAND_SUPPLY_LEGEND_ORDER.length)
    switches.forEach((s, i) => {
      expect(s).toHaveAccessibleName(new RegExp(SWITCH_LABELS[i]))
      expect(s).toHaveAttribute('aria-checked', 'true')
    })
  })

  function srTable() {
    const tables = screen.getAllByRole('table', { hidden: true })
    const found = tables.find((t) => within(t).queryByRole('columnheader', { name: 'Weekday', hidden: true }))
    if (!found) throw new Error('no table with a Weekday column')
    return found
  }
  const headers = (t: HTMLElement) => within(t).getAllByRole('columnheader', { hidden: true }).map((h) => h.textContent?.trim())

  it('always has a table with Day, Weekday and one column per series in the DOM', () => {
    renderSummary()
    const t = srTable()
    expect(headers(t)).toEqual(expect.arrayContaining(['Day', 'Weekday', ...SWITCH_LABELS]))
    expect(headers(t)).toHaveLength(2 + SWITCH_LABELS.length)
    const rows = within(t).getAllByRole('row', { hidden: true })
    expect(rows).toHaveLength(1 + 14)
  })

  it('puts the plotted numbers in that table', () => {
    renderSummary()
    const t = srTable()
    const hs = headers(t)
    const first = within(within(t).getAllByRole('row', { hidden: true })[1]).getAllByRole('cell', { hidden: true })
    expect(first[hs.indexOf('Day')]).toHaveTextContent('1')
    expect(first[hs.indexOf('Weekday')].textContent).toMatch(/^Mon/)
    expect(first[hs.indexOf('Market demand')]).toHaveTextContent('40')
    expect(first[hs.indexOf('Pulque delivered')]).toHaveTextContent('60')
    expect(first[hs.indexOf('Units sold')]).toHaveTextContent('38')
    expect(first[hs.indexOf('Units spoiled')]).toHaveTextContent('2')
    expect(first[hs.indexOf('Backlog at day end')]).toHaveTextContent('0')
  })

  it('a switch turned off removes its dataset from the chart config and its column from the table', async () => {
    renderSummary()
    await userEvent.click(screen.getByRole('switch', { name: /Units sold/ }))
    expect(screen.getByRole('switch', { name: /Units sold/ })).toHaveAttribute('aria-checked', 'false')
    expect(chartWithDataset('Market demand')!.data.datasets.map((d) => d.label)).toEqual([
      'Pulque delivered',
      'Units spoiled',
      'Backlog at day end',
      'Market demand',
    ])
    expect(headers(srTable())).not.toContain('Units sold')
    expect(headers(srTable())).toContain('Units spoiled')
  })

  it('turning it back on restores the series, demand still last', async () => {
    renderSummary()
    const sold = screen.getByRole('switch', { name: /Units sold/ })
    await userEvent.click(sold)
    await userEvent.click(sold)
    expect(sold).toHaveAttribute('aria-checked', 'true')
    const labels = chartWithDataset('Market demand')!.data.datasets.map((d) => d.label)
    expect(labels).toHaveLength(5)
    expect(labels.at(-1)).toBe('Market demand')
    expect(headers(srTable())).toContain('Units sold')
  })

  it('can bring series in one at a time, demand first', async () => {
    renderSummary()
    for (const name of [/Pulque delivered/, /Units sold/, /Units spoiled/, /Backlog at day end/]) {
      await userEvent.click(screen.getByRole('switch', { name }))
    }
    expect(chartWithDataset('Market demand')!.data.datasets.map((d) => d.label)).toEqual(['Market demand'])
    await userEvent.click(screen.getByRole('switch', { name: /Pulque delivered/ }))
    expect(chartWithDataset('Market demand')!.data.datasets.map((d) => d.label)).toEqual(['Pulque delivered', 'Market demand'])
  })
})

describe('block 3: where the pulque went (criterion 12, failure mode 10)', () => {
  it('plots the five datasets in stack order from the view', () => {
    renderSummary()
    const chart = chartWithDataset('Sold to pulquerías')!
    expect(chart.type).toBe('bar')
    expect(chart.options.indexAxis).toBe('y')
    expect(chart.data.datasets.map((d) => d.label)).toEqual([
      'Sold',
      'Sold to pulquerías',
      'Spoiled',
      'Lost in transit',
      'Liquidated at the end',
    ])
    expect(chart.data.datasets[0].data).toEqual([520, 300, 410])
    expect(chart.data.datasets[1].data).toEqual([0, 0, 4])
  })

  it('shows Bought from pulquerías, Peak backlog and Days with backlog beside each bar, in rank order', () => {
    renderSummary()
    expect(numbersAfter('Bought from pulquerías')).toEqual(['2', '0', '16'])
    expect(numbersAfter('Peak backlog')).toEqual(['3', '11', '7'])
    expect(numbersAfter('Days with backlog')).toEqual(['5', '9', '2'])
  })

  it('gives each pulquería a row tall enough for its notes: 64px for three lines, 48px for two, plus 48px of axis', () => {
    const plot = () => screen.getByRole('img', { name: /Stacked horizontal bars of units sold/ })
    const { unmount } = renderSummary()
    // three pulquerías with the peer market's Bought from line: (3 x 64 + 48) / 16
    expect(plot()).toHaveStyle({ height: '15rem' })
    unmount()
    renderSummary({ view: makeView(withoutPeer) })
    // two lines each: (3 x 48 + 48) / 16
    expect(plot()).toHaveStyle({ height: '12rem' })
  })

  it('layout bug: the note rows share the plot area evenly instead of a fixed 40px each, so three lines never spill', () => {
    renderSummary()
    const notes = screen.getByText(/^Peak backlog 3$/).closest('ul')!
    const rows = Array.from(notes.children) as HTMLElement[]
    expect(rows).toHaveLength(3)
    for (const row of rows) {
      expect(row.className).toContain('flex-1')
      expect(row.className).not.toMatch(/\bh-10\b/)
      expect(row.children).toHaveLength(3)
    }
    // the column starts where the plot starts and stops where the axis begins (LAID_OUT)
    expect(notes).toHaveStyle({ paddingTop: '6px', paddingBottom: '50px' })
  })

  it('criterion 13 / failure mode 11: without peer fields there is no peer segment and no Bought from line', () => {
    renderSummary({ view: makeView(withoutPeer) })
    const chart = chartWithDataset('Sold')!
    expect(chart.data.datasets.map((d) => d.label)).not.toContain('Sold to pulquerías')
    expect(screen.queryByText(/Bought from pulquerías/)).not.toBeInTheDocument()
    expect(numbersAfter('Peak backlog')).toEqual(['3', '11', '7'])
  })
})

describe('print markup (criterion 10, design.md 8.8)', () => {
  it('hides blocks 3, 5 and 6 in print', () => {
    renderSummary()
    expect(hasClassAncestor(chartWithDataset('Sold to pulquerías')!.element, 'print:hidden')).toBe(true)
    expect(hasClassAncestor(figureTitled('Cooperation votes'), 'print:hidden')).toBe(true)
    expect(hasClassAncestor(figureTitled('Spot price over the game'), 'print:hidden')).toBe(true)
    expect(hasClassAncestor(screen.getByRole('button', { name: 'Export CSV' }), 'print:hidden')).toBe(true)
    expect(hasClassAncestor(screen.getByText('Debrief notes'), 'print:hidden')).toBe(true)
  })

  it('prints blocks 1, 2 and 4', () => {
    renderSummary()
    expect(hasClassAncestor(screen.getByRole('table', { name: 'Ratios' }), 'print:hidden')).toBe(false)
    expect(hasClassAncestor(figureTitled(CHART_TITLE), 'print:hidden')).toBe(false)
    expect(hasClassAncestor(chartWithDataset('Market demand')!.element, 'print:hidden')).toBe(false)
  })

  it('hides the legend switches in print', () => {
    renderSummary()
    for (const s of screen.getAllByRole('switch')) expect(hasClassAncestor(s, 'print:hidden')).toBe(true)
  })

  it('hides the ChartBox Table / Chart toggle of the chart in print', () => {
    renderSummary()
    const toggle = within(figureTitled(CHART_TITLE)).getByRole('button', { name: /Show table/ })
    expect(hasClassAncestor(toggle, 'print:hidden')).toBe(true)
  })

  it('keeps each printed block together on the page', () => {
    renderSummary()
    expect(hasClassAncestor(screen.getByRole('table', { name: 'Ratios' }), 'print:break-inside-avoid')).toBe(true)
    expect(hasClassAncestor(figureTitled(CHART_TITLE), 'print:break-inside-avoid')).toBe(true)
    const list = document.querySelector('[class~="print:block"]')!
    expect(hasClassAncestor(list, 'print:break-inside-avoid')).toBe(true)
  })

  function compactList(): HTMLElement {
    const lists = Array.from(document.querySelectorAll<HTMLElement>('[class~="print:block"]')).filter((el) =>
      el.className.split(/\s+/).includes('hidden'),
    )
    expect(lists).toHaveLength(1)
    return lists[0]
  }

  it('has a print-only compact leaderboard with rank, name and profit, in rank order, while hidden', () => {
    renderSummary({ viewer: HOST })
    const text = compactList().textContent ?? ''
    const order = ['P2', 'P3', 'P1'].map((alias) => text.indexOf(NAMES[alias]))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    // The figures print whether or not they are revealed; they may be text or an attribute of the markup.
    for (const profit of PROFITS) expect(compactList().outerHTML).toContain(profit)
    for (const rank of ['1', '2', '3']) expect(text).toContain(rank)
  })

  it('still has the same compact leaderboard once revealed', () => {
    renderSummary({ viewer: HOST })
    fireEvent.click(screen.getByRole('button', { name: 'Reveal' }))
    for (const profit of PROFITS) expect(compactList().outerHTML).toContain(profit)
  })
})

describe('block 6: host actions', () => {
  it('offers the host Export CSV, Export JSON and the 24-hour note', () => {
    renderSummary({ viewer: HOST })
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export JSON' })).toBeInTheDocument()
    expect(
      screen.getByText('Download the data during the debrief: the room expires 24 hours after its last activity.'),
    ).toBeInTheDocument()
  })

  it('offers a player none of the host actions', () => {
    renderSummary({ viewer: PLAYER, hostSecret: null })
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Export JSON' })).not.toBeInTheDocument()
    expect(screen.queryByText('Debrief notes')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Play again' })).not.toBeInTheDocument()
  })

  it('passes the host secret to the export request', async () => {
    spy = mockHttp(() => ({ status: 200, data: new Blob(['x']) }))
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    renderSummary({ viewer: HOST, hostSecret: 'sec-77' })
    await userEvent.click(screen.getByRole('button', { name: 'Export JSON' }))
    await waitFor(() => expect(spy!.seen).toHaveLength(1))
    expect(header(spy!.seen[0], 'X-Host-Secret')).toBe('sec-77')
  })
})

describe('Debrief notes', () => {
  const POINTS = [
    'Who made the most profit, and who wasted the most? Were they the same players?',
    'Look at the chart: did deliveries rise before Thursday or after? Lead time and futures exist so you can be early.',
    'Every spoiled unit was paid for twice: its price, and the reputation it cost.',
    'Backlog lost reputation, and reputation is tomorrow\'s share of demand. Rivals gained what you lost.',
    'Futures never beat spot on price on average; they win on availability on short days.',
    'Insurance: did refunds outweigh fees? Was sharing on, and what did that do to its value?',
    'Cooperation: on how many days did everyone agree, and who got served on short days?',
    'Peer market: who sold to whom on short days, and at what price? Did selling old units beat letting them spoil, and did any seller create its own backlog?',
    'Nobody was careless: lead time, perishability and scarce supply produced these outcomes.',
  ]

  it('is a collapsible, closed by default', () => {
    renderSummary({ viewer: HOST })
    const details = screen.getByText('Debrief notes').closest('details')!
    expect(details).not.toBeNull()
    expect(details.open).toBe(false)
  })

  it('opens on click and holds the nine talking points, verbatim, as a numbered list', async () => {
    renderSummary({ viewer: HOST })
    await userEvent.click(screen.getByText('Debrief notes'))
    const details = screen.getByText('Debrief notes').closest('details')!
    expect(details.open).toBe(true)
    const list = details.querySelector('ol')!
    expect(list).not.toBeNull()
    const items = Array.from(list.querySelectorAll(':scope > li')).map((li) => li.textContent?.trim())
    expect(items).toEqual(POINTS)
    expect(items).toHaveLength(9)
  })
})

describe('the claim prompt appears only under all three conditions (criterion 8, failure mode 7)', () => {
  const PROMPT = 'Sign in to keep these results in your profile.'

  function guestWhoPlayed(gameId = GAME_ID) {
    auth.mode = 'guest'
    getOrCreateGuestId()
    markGamePlayed(gameId)
  }
  const player = () => renderSummary({ viewer: PLAYER, hostSecret: null })

  it('shows it for a guest with a guest id who played this game', () => {
    guestWhoPlayed()
    player()
    expect(screen.getByText(PROMPT)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument()
  })

  it('failure mode 7: not for a signed-in user', () => {
    guestWhoPlayed()
    auth.mode = 'authenticated'
    player()
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign in with Google' })).not.toBeInTheDocument()
  })

  it('not before the visitor has chosen a mode', () => {
    guestWhoPlayed()
    auth.mode = null
    player()
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument()
  })

  it('not without a guest id', () => {
    auth.mode = 'guest'
    markGamePlayed(GAME_ID)
    player()
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument()
  })

  it('not for a guest who did not play this game', () => {
    auth.mode = 'guest'
    getOrCreateGuestId()
    player()
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument()
  })

  it('not for a guest who played only another game', () => {
    guestWhoPlayed('ffff00')
    player()
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument()
  })

  it('not for a guest whose only link is a session token under this room code', () => {
    auth.mode = 'guest'
    getOrCreateGuestId()
    setSessionToken(ROOM, 'tok')
    player()
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument()
  })
})

describe('Play again', () => {
  function asHostOfThisGame(config: unknown = FULL_CONFIG, over: Record<string, unknown> = {}) {
    useGameStore.setState({ roomCode: ROOM, gamePublicId: GAME_ID, isHost: true, config: config as never, ...over })
  }

  it('is offered to the host who holds this game\'s full config', () => {
    asHostOfThisGame()
    renderSummary({ viewer: HOST })
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument()
  })

  it.each([
    ['the store holds no config (a summary loaded by URL)', () => asHostOfThisGame(null)],
    [
      'the store holds another game\'s config under the same room code',
      () => asHostOfThisGame(FULL_CONFIG, { gamePublicId: 'ffff00' }),
    ],
    [
      'the store holds only the public config',
      () =>
        asHostOfThisGame(
          {
            demand: { retail_price: 30 },
            stock: { conservation_extra_fresh_days: 2, conservation_cost_per_unit: 1 },
            peer_market: { enabled: true },
            transport: { unit_cost: 1 },
          },
          { isHost: false },
        ),
    ],
  ])('is not offered when %s', (_why, setup) => {
    setup()
    renderSummary({ viewer: HOST })
    expect(screen.queryByRole('button', { name: 'Play again' })).not.toBeInTheDocument()
  })

  it('is not offered to a player', () => {
    asHostOfThisGame()
    renderSummary({ viewer: PLAYER, hostSecret: null })
    expect(screen.queryByRole('button', { name: 'Play again' })).not.toBeInTheDocument()
  })

  it('creates a new room, stores its secret, sends the config with a null seed and opens its host page', async () => {
    asHostOfThisGame()
    spy = mockHttp((cfg) => {
      if (verb(cfg) === 'POST' && urlPath(cfg) === 'rooms/create') {
        return { status: 200, data: { room_code: 'NEW123', host_secret: 'sec-new', state: 'lobby', config: {} } }
      }
      return { status: 200, data: { config: {} } }
    })
    const { router } = renderSummary({ viewer: HOST })
    await userEvent.click(screen.getByRole('button', { name: 'Play again' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/host/NEW123'))

    expect(spy.seen.map((c) => `${verb(c)} ${urlPath(c)}`)).toEqual(['POST rooms/create', 'PUT rooms/NEW123/config'])
    const put = spy.seen[1]
    expect(header(put, 'X-Host-Secret')).toBe('sec-new')
    expect(jsonBody(put)).toEqual({ config: { ...FULL_CONFIG, random_seed: null } })
    expect(getHostSecret('NEW123')).toBe('sec-new')
  })

  it('does not send the finished game\'s seed to the new room', async () => {
    asHostOfThisGame()
    spy = mockHttp((cfg) =>
      urlPath(cfg) === 'rooms/create'
        ? { status: 200, data: { room_code: 'NEW123', host_secret: 's', state: 'lobby', config: {} } }
        : { status: 200, data: { config: {} } },
    )
    const { router } = renderSummary({ viewer: HOST })
    await userEvent.click(screen.getByRole('button', { name: 'Play again' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/host/NEW123'))
    expect(JSON.stringify(jsonBody(spy.seen[1]))).not.toContain('424242')
  })
})

describe('nothing is computed in the client (criterion 3)', () => {
  it('shows server figures only: a changed field changes the screen, nothing else moves', () => {
    const view = makeView((s) => {
      s.players.P2.total_profit = 99999.99
    })
    renderSummary({ view, viewer: PLAYER, hostSecret: null })
    expect(onScreen(formatMoney(99999.99)).length).toBeGreaterThan(0)
    expect(onScreen(formatMoney(5123.45))).toHaveLength(0)
  })
})
