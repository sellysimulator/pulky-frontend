/**
 * Section 28 — HostConsole with SubmissionTracker, MarketCharts and EventHistory (plan 28 §3.2–§3.6).
 * Acceptance 2 (console, finished), 4, 5, 6, 9; failure modes 3, 5, 9 (and 7 for the end action).
 */
import { createElement } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase', () => ({ auth: { currentUser: null }, googleProvider: {}, app: {} }))
vi.mock('react-chartjs-2', () => {
  const make = (type: string) => (props: { data?: unknown; options?: unknown }) =>
    createElement('div', {
      'data-testid': `chart-${type}`,
      'data-chart': JSON.stringify({ type, data: props.data, options: props.options }, (_k, v) =>
        typeof v === 'function' ? '__fn__' : v,
      ),
    })
  return { Bar: make('bar'), Line: make('line'), Pie: make('pie'), Doughnut: make('doughnut') }
})

import { socket } from '../api/socket'
import { pulqueriaLine, pulqueriaStyle } from '../components/charts/chartSetup'
import { buildProfitRaceConfig } from '../components/results/resultsChartsConfig'
import HostConsole from '../components/host/HostConsole'
import MarketCharts from '../components/host/MarketCharts'
import type { HostHistories } from '../components/host/presentationData'
import type { DayRecord, GameConfig, HostView, MarketDay, PublicDayResults } from '../types/game'

const NAMES: Record<string, string> = { P1: 'Don Agave', P2: 'La Chula', P3: 'El Tinacal' }
const WD = ['mon', 'tue', 'wed', 'thu', 'fri'] as const
const MULT = [0.25, 0.5, 0.75, 1, 1]

type Obj = Record<string, unknown>

function config(peer: boolean): Obj {
  return {
    peer_market: { enabled: peer },
    supplier: { base_price: 12, spot_spread: 0.337 },
    transport: { failure_probability: 0.1234 },
  }
}

function hostView(peer = true, over: Obj = {}): HostView {
  const players: Obj = {}
  for (const [a, name] of Object.entries(NAMES)) {
    players[a] = {
      display_name: name,
      connected: true,
      has_submitted: a === 'P1',
      stock_units: 42,
      expected_spoil_tonight: 3.4,
      in_transit_units: 30,
      open_futures_units: 25,
      backlog: 0,
      reputation: 0.6,
      market_share: 0.33,
      cumulative_profit: 1120.55,
      cash: 6120.55,
      fill_rate: 0.9,
      waste_rate: 0.05,
      last_incoterm_tier: 'cip',
      last_peer_bought: 10,
      last_peer_sold: 4,
    }
  }
  return {
    full: true,
    state: 'running',
    day: 5,
    duration_days: 14,
    weekday: 'fri',
    phase: 'deciding',
    seed: 987654321,
    config: config(peer),
    spot_range: { low: 7.96, high: 16.04 },
    awaiting: ['P2', 'P3'],
    players,
    leaderboard: [],
    ...over,
  } as unknown as HostView
}

function market(day: number, over: Obj = {}): MarketDay {
  return {
    day,
    weekday: WD[day - 1],
    weekday_multiplier: MULT[day - 1],
    expected_demand: 100,
    demand_total: 100 + day,
    capacity: 81,
    disrupted: false,
    spot_price: day === 5 ? 13.4 : 12.5,
    cooperation: false,
    cooperators: 1,
    refrigeration_failure: false,
    units_sold_total: 90 + day,
    peer_units: 0,
    peer_avg_price: null,
    ...over,
  } as unknown as MarketDay
}

function pub(day: number): PublicDayResults {
  const players: Obj = {}
  for (const [a, name] of Object.entries(NAMES)) {
    players[a] = { display_name: name, units_sold: 30, market_share: 0.33, reputation: 0.6 }
  }
  return {
    day,
    weekday: WD[day - 1],
    demand_total: 100 + day,
    units_sold_total: 90 + day,
    spot_price: 12.5,
    capacity: 81,
    disrupted: false,
    cooperation: false,
    cooperators: 1,
    refrigeration_failure: false,
    peer_units: 0,
    peer_avg_price: null,
    players,
  } as unknown as PublicDayResults
}

function rec(day: number, over: Obj = {}): Obj {
  return {
    day,
    weekday: WD[day - 1],
    order_spot: 0,
    futures_due: 0,
    spoiled: 0,
    lost_transport: 0,
    peer_trades: [],
    ...over,
  }
}

const sell = (counterparty: string, qty: number, quality: number, price: number, lot = 'L1'): Obj => ({
  side: 'sell',
  counterparty,
  lot_id: lot,
  qty,
  quality,
  price,
})
const buy = (counterparty: string, qty: number, quality: number, price: number, lot = 'B5-1'): Obj => ({
  side: 'buy',
  counterparty,
  lot_id: lot,
  qty,
  quality,
  price,
})

/** Days 1-5 closed. Day 3: a disruption. Day 5: disruption, failure, cooperation and five peer trades. */
function histories(over: Partial<HostHistories> = {}): HostHistories {
  const days = [1, 2, 3, 4, 5]
  return {
    players: {
      P1: [
        rec(4, { order_spot: 10, futures_due: 5, spoiled: 2 }),
        rec(5, {
          order_spot: 41,
          futures_due: 13,
          spoiled: 6,
          peer_trades: [buy('P3', 10, 62, 15, 'B5-1'), buy('P2', 3, 55, 16, 'B5-2')],
        }),
      ],
      P2: [
        rec(4, { order_spot: 20, futures_due: 5, spoiled: 11 }),
        rec(5, {
          order_spot: 52,
          futures_due: 17,
          spoiled: 9,
          peer_trades: [sell('P3', 5, 80, 14.5, 'L2'), sell('P1', 3, 55, 16, 'L3')],
        }),
      ],
      P3: [
        rec(5, {
          peer_trades: [sell('P1', 10, 62, 15, 'L4'), sell('P7', 2, 60, 15, 'L5'), buy('P2', 5, 80, 14.5, 'B5-3')],
        }),
      ],
    } as unknown as HostHistories['players'],
    publicHistory: days.map(pub),
    marketHistory: [
      market(1),
      market(2),
      market(3, { disrupted: true }),
      market(4, { peer_units: 16, peer_avg_price: 14.25 }),
      market(5, { disrupted: true, refrigeration_failure: true, cooperation: true, peer_units: 18, peer_avg_price: 15.3 }),
    ],
    race: { P1: [5, 9, 12, 20, 31], P2: [4, 8, 11, 15, 26], P3: [1, 2, 3, 4, 9] },
    ...over,
  }
}

const EMPTY: HostHistories = { players: {}, race: {}, publicHistory: [], marketHistory: [] }

let emit: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  emit = vi.spyOn(socket, 'emit').mockImplementation(() => socket)
})
afterEach(() => emit.mockRestore())

interface Props {
  hostView: HostView
  histories: HostHistories
  roomCode: string
  hostSecret: string | null
  finished: boolean
  gamePublicId: string | null
  onPresent(): void
}

function renderConsole(over: Partial<Props> = {}) {
  const props: Props = {
    hostView: hostView(),
    histories: histories(),
    roomCode: 'ABC234',
    hostSecret: 's3cret',
    finished: false,
    gamePublicId: null,
    onPresent: () => {},
    ...over,
  }
  return render(
    <MemoryRouter>
      <HostConsole {...props} />
    </MemoryRouter>,
  )
}

const bodyText = (): string => (document.body.textContent ?? '').replace(/\s+/g, ' ')

/** Deepest elements (inside `root`) whose whole normalised text is exactly `text`. */
function lines(root: ParentNode, text: string): Element[] {
  return Array.from(root.querySelectorAll('*')).filter((el) => {
    const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (t !== text) return false
    return !Array.from(el.children).some((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim() === text)
  })
}

describe('HostConsole header', () => {
  it('shows Room {code} · Day {day}/{duration} ({Wkd}) as the h1', () => {
    renderConsole()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Room ABC234 · Day 5/14 (Fri)')
  })

  it('lays out the tracker, the players table, the charts and the events', () => {
    renderConsole()
    const tracker = screen.getByRole('region', { name: 'Submissions' })
    const table = screen.getByRole('table', { name: 'Pulquerías' })
    const firstChart = screen.getAllByRole('figure')[0]
    const events = screen.getByRole('region', { name: 'Events' })
    const follows = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(follows(tracker, table)).toBe(true)
    expect(follows(table, firstChart)).toBe(true)
    expect(follows(firstChart, events)).toBe(true)
  })

  it('Presentation mode calls onPresent', () => {
    const onPresent = vi.fn()
    renderConsole({ onPresent })
    fireEvent.click(screen.getByRole('button', { name: 'Presentation mode' }))
    expect(onPresent).toHaveBeenCalledTimes(1)
  })
})

describe('HostConsole End game early (acceptance 9, failure modes 5 and 7)', () => {
  const endCalls = () => emit.mock.calls.filter((c: unknown[]) => c[0] === 'end_game_early')

  it('failure mode 5: clicking End game early alone emits nothing', () => {
    renderConsole()
    fireEvent.click(screen.getByRole('button', { name: 'End game early' }))
    expect(endCalls()).toHaveLength(0)
  })

  it('cancelling emits nothing', () => {
    renderConsole()
    fireEvent.click(screen.getByRole('button', { name: 'End game early' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(endCalls()).toHaveLength(0)
  })

  it('confirming emits end_game_early exactly once with the room and the host secret', () => {
    renderConsole()
    fireEvent.click(screen.getByRole('button', { name: 'End game early' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'End game' }))
    expect(endCalls()).toHaveLength(1)
    expect(endCalls()[0][1]).toEqual({ room_id: 'ABC234', host_secret: 's3cret' })
  })
})

describe('HostConsole when finished (acceptance 2)', () => {
  it('replaces the controls with a See the results link to the game, by id', () => {
    renderConsole({ finished: true, gamePublicId: 'g8f2c1' })
    const link = screen.getByRole('link', { name: 'See the results' })
    expect(link).toHaveAttribute('href', '/results/g8f2c1')
    expect(screen.queryByRole('button', { name: 'Presentation mode' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'End game early' })).toBeNull()
  })

  it('never links by room code: with no game id yet there is no link and no controls', () => {
    renderConsole({ finished: true, gamePublicId: null })
    expect(screen.queryByRole('link', { name: 'See the results' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Presentation mode' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'End game early' })).toBeNull()
  })

  it('shows no See the results link while the game runs', () => {
    renderConsole()
    expect(screen.queryByRole('link', { name: 'See the results' })).toBeNull()
  })

  it('still shows the console panels at the end', () => {
    renderConsole({ finished: true })
    expect(screen.getByRole('table', { name: 'Pulquerías' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Events' })).toBeInTheDocument()
  })

  it('drops the Submissions card, which would read everyone as still deciding', () => {
    renderConsole({ finished: true })
    expect(screen.queryByRole('region', { name: 'Submissions' })).toBeNull()
  })
})

describe('SubmissionTracker (acceptance 4, failure mode 3)', () => {
  it('shows each pulquería with its name and a state word', () => {
    renderConsole()
    const card = screen.getByRole('region', { name: 'Submissions' })
    expect(lines(card, 'Don Agave submitted').length).toBeGreaterThan(0)
    expect(lines(card, 'La Chula deciding').length).toBeGreaterThan(0)
    expect(lines(card, 'El Tinacal deciding').length).toBeGreaterThan(0)
  })

  it('uses the CircleCheck icon for submitted and CircleDashed for deciding', () => {
    renderConsole()
    const card = screen.getByRole('region', { name: 'Submissions' })
    expect(card.querySelectorAll('svg.lucide-circle-check')).toHaveLength(1)
    expect(card.querySelectorAll('svg.lucide-circle-dashed')).toHaveLength(2)
  })

  it('lists the chips in alias order', () => {
    renderConsole()
    const card = screen.getByRole('region', { name: 'Submissions' })
    const text = card.textContent ?? ''
    expect(text.indexOf('Don Agave')).toBeLessThan(text.indexOf('La Chula'))
    expect(text.indexOf('La Chula')).toBeLessThan(text.indexOf('El Tinacal'))
  })

  it('failure mode 3: carries names and state words only, no figure of any kind', () => {
    const view = hostView(true) as unknown as { players: Record<string, Obj> }
    view.players.P1.pending_decision = { order_spot: 7771, order_futures: 6662, incoterm_tier: 'ddp' }
    view.players.P1.decision = { order_spot: 7771 }
    renderConsole({ hostView: view as unknown as HostView })
    const card = screen.getByRole('region', { name: 'Submissions' })
    expect(card.textContent ?? '').not.toMatch(/\d/)
    expect(bodyText()).not.toContain('7771')
    expect(bodyText()).not.toContain('6662')
  })
})

describe('MarketCharts (acceptance 5)', () => {
  const titles = (): string[] =>
    screen.getAllByRole('figure').map((f) => (f.querySelector('figcaption')?.textContent ?? '').trim())

  const ORDER = [
    'Profit race',
    'Market share',
    'Reputation',
    'Demand vs units sold',
    'Spot price',
    'Capacity vs orders',
    'Spoilage per day',
    'Peer units traded',
  ]

  const figureOf = (title: string): HTMLElement => {
    const f = screen.getAllByRole('figure').find((el) => (el.querySelector('figcaption')?.textContent ?? '').includes(title))
    if (!f) throw new Error(`no chart ${title}`)
    return f
  }

  const chartOf = (title: string): { type: string; data: { datasets: Obj[] }; options: Obj } =>
    JSON.parse(figureOf(title).querySelector('[data-testid^="chart-"]')!.getAttribute('data-chart')!)

  const tableOf = (title: string): HTMLElement => {
    const f = figureOf(title)
    fireEvent.click(within(f).getByRole('button', { name: 'Show table' }))
    return within(f).getByRole('table')
  }

  it('renders the eight charts in order, the race first, when the peer market is on', () => {
    renderConsole()
    const got = titles()
    expect(got).toHaveLength(8)
    ORDER.forEach((t, i) => expect(got[i]).toContain(t))
  })

  it('renders seven charts and no Peer units traded when the peer market is off', () => {
    renderConsole({ hostView: hostView(false) })
    const got = titles()
    expect(got).toHaveLength(7)
    ORDER.slice(0, 7).forEach((t, i) => expect(got[i]).toContain(t))
    expect(got.some((t) => t.includes('Peer units traded'))).toBe(false)
  })

  it('gives every chart a table view', () => {
    renderConsole()
    for (const t of ORDER) expect(tableOf(t)).toBeInTheDocument()
  })

  it('Market share is stacked with one dataset per pulquería and Reputation is a line per pulquería', () => {
    renderConsole()
    const share = chartOf('Market share')
    expect(share.data.datasets).toHaveLength(3)
    const scales = share.options.scales as { y?: { stacked?: boolean } }
    expect(scales.y?.stacked).toBe(true)
    const rep = chartOf('Reputation')
    expect(rep.type).toBe('line')
    expect(rep.data.datasets).toHaveLength(3)
  })

  it('Demand vs units sold shades the days whose weekday multiplier is 1', () => {
    renderConsole()
    const demand = chartOf('Demand vs units sold')
    const plugins = demand.options.plugins as { peakShading?: { days?: number[] } }
    expect(plugins.peakShading?.days).toEqual([3, 4])
  })

  it('Demand vs units sold lists the market totals per day', () => {
    renderConsole()
    const text = tableOf('Demand vs units sold').textContent ?? ''
    expect(text).toContain('105')
    expect(text).toContain('95')
  })

  it('Spot price carries a dashed base-price line from config.supplier.base_price', () => {
    renderConsole()
    const spot = chartOf('Spot price')
    const base = spot.data.datasets.find(
      (d) => Array.isArray(d.borderDash) && (d.borderDash as number[]).length > 0 && (d.data as number[]).every((v) => v === 12),
    )
    expect(base).toBeDefined()
    expect(tableOf('Spot price').textContent).toContain('13.40')
  })

  it("Spot price shades the server's spot range, never one it works out from the spread", () => {
    renderConsole()
    const spot = chartOf('Spot price')
    const low = spot.data.datasets.find((d) => d.label === 'Spot range low')
    const high = spot.data.datasets.find((d) => d.label === 'Spot range')
    expect((low?.data as number[]).every((v) => v === 7.96)).toBe(true)
    expect((high?.data as number[]).every((v) => v === 16.04)).toBe(true)
  })

  it('Capacity vs orders sums spot orders and futures due over every pulquería, per day', () => {
    renderConsole()
    const text = tableOf('Capacity vs orders').textContent ?? ''
    expect(text).toContain('123') // (41 + 13) + (52 + 17) on day 5
    expect(text).toContain('81')
  })

  it('Spoilage per day: Day, one column per pulquería, then Total summing every pulquería', () => {
    renderConsole()
    const table = tableOf('Spoilage per day')
    const heads = within(table).getAllByRole('columnheader').map((h) => h.textContent?.trim())
    expect(heads[0]).toBe('Day')
    expect(heads.slice(1)).toEqual(['Don Agave', 'La Chula', 'El Tinacal', 'Total'])
    const rows = within(table).getAllByRole('row').slice(1)
    const cells = (i: number) => Array.from(rows[i].querySelectorAll('th, td')).map((c) => c.textContent?.trim())
    const d5 = cells(4).slice(1)
    expect([d5[0], d5[1], d5[3]]).toEqual(['6', '9', '15']) // day 5
    expect(cells(3).slice(1)).toEqual(['2', '11', '—', '13']) // day 4
  })

  it('Peer units traded is a single-series bar chart of peer_units', () => {
    renderConsole()
    const peer = chartOf('Peer units traded')
    expect(peer.type).toBe('bar')
    expect(peer.data.datasets).toHaveLength(1)
    expect(peer.data.datasets[0].data).toEqual([0, 0, 0, 16, 18])
  })

  it('Peer units traded table: Day, Units and Avg price, with a dash for a null price', () => {
    renderConsole()
    const table = tableOf('Peer units traded')
    for (const h of ['Day', 'Units', 'Avg price']) expect(within(table).getByRole('columnheader', { name: h })).toBeInTheDocument()
    const row = (day: string) =>
      within(table)
        .getAllByRole('row')
        .find((r) => new RegExp(`^(Day )?${day}$`).test(r.querySelector('th, td')?.textContent?.trim() ?? ''))!
    const four = Array.from(row('4').querySelectorAll('th, td')).map((c) => c.textContent?.trim())
    expect(four[1]).toBe('16')
    expect(four[2]).toBe('$14.25')
    const three = Array.from(row('3').querySelectorAll('th, td')).map((c) => c.textContent?.trim())
    expect(three[1]).toBe('0')
    expect(three[2]).toBe('—')
  })

  it('before the first day closes shows the empty state instead of charts', () => {
    renderConsole({ histories: EMPTY })
    expect(screen.getByText('No days closed yet')).toBeInTheDocument()
    expect(screen.getByText('Charts fill in as days close.')).toBeInTheDocument()
    expect(screen.queryAllByRole('figure')).toHaveLength(0)
  })

  it('works with no config (the spot chart simply has no base-price line)', () => {
    const view = hostView(true)
    render(<MarketCharts hostView={view} histories={histories()} config={null} />)
    expect(screen.getAllByRole('figure').length).toBeGreaterThanOrEqual(7)
  })

  it('draws the charts from the histories it is given, not from the host view', () => {
    const view = hostView(true, { public_history: [], market_history: [] })
    render(<MarketCharts hostView={view} histories={histories()} config={view.config as GameConfig} />)
    expect(screen.getAllByRole('figure')).toHaveLength(8)
  })
})

describe('EventHistory (acceptance 6, failure mode 9)', () => {
  const region = (): HTMLElement => screen.getByRole('region', { name: 'Events' })

  const EXPECTED = [
    'Day 5 (Fri): supplier disrupted',
    'Day 5 (Fri): refrigeration failure',
    'Day 5 (Fri): everyone cooperated',
    'Day 5 (Fri): La Chula sold 5 to El Tinacal at $14.50 (80%)',
    'Day 5 (Fri): La Chula sold 3 to Don Agave at $16.00 (55%)',
    'Day 5 (Fri): El Tinacal sold 10 to Don Agave at $15.00 (62%)',
    'Day 5 (Fri): El Tinacal sold 2 to P7 at $15.00 (60%)',
    'Day 3 (Wed): supplier disrupted',
  ]

  const allLines = (root: HTMLElement): string[] =>
    Array.from(root.querySelectorAll('*'))
      .filter((el) => {
        const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
        return /^Day \d+ \(/.test(t) && !Array.from(el.children).some((c) => /^Day \d+ \(/.test((c.textContent ?? '').trim()))
      })
      .map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim())

  it('lists market events and trades newest first, in the specified order within a day', () => {
    renderConsole()
    expect(allLines(region())).toEqual(EXPECTED)
  })

  it('failure mode 9: each trade is listed once even though both parties hold it', () => {
    renderConsole()
    const root = region()
    for (const expected of EXPECTED.filter((l) => l.includes(' sold '))) {
      expect(lines(root, expected), expected).toHaveLength(1)
    }
    expect(allLines(root).filter((l) => l.includes(' sold '))).toHaveLength(4)
    expect(root.textContent).not.toMatch(/bought/)
  })

  it('writes an unknown alias as itself', () => {
    renderConsole()
    expect(lines(region(), 'Day 5 (Fri): El Tinacal sold 2 to P7 at $15.00 (60%)')).toHaveLength(1)
  })

  it('draws the concept icons', () => {
    renderConsole()
    const root = region()
    expect(root.querySelector('svg.lucide-unplug')).not.toBeNull()
    expect(root.querySelector('svg.lucide-thermometer-sun')).not.toBeNull()
    expect(root.querySelector('svg.lucide-handshake')).not.toBeNull()
    expect(root.querySelectorAll('svg.lucide-arrow-left-right')).toHaveLength(4)
  })

  it('says No events yet. when nothing happened', () => {
    renderConsole({
      histories: {
        players: { P1: [rec(1) as unknown as DayRecord] } as unknown as HostHistories['players'],
        race: { P1: [0] },
        publicHistory: [pub(1)],
        marketHistory: [market(1), market(2)],
      },
    })
    expect(within(region()).getByText('No events yet.')).toBeInTheDocument()
  })

  it('says No events yet. before any day has closed', () => {
    renderConsole({ histories: EMPTY })
    expect(within(region()).getByText('No events yet.')).toBeInTheDocument()
  })
})

/* ------------------------------------------------------------------ section 37 */

const M2: Record<string, string> = { P1: 'Don Agave', P2: 'La Chula' }

/** plan 37 §4 as the console's inputs: two pulquerías, closed days Mon-Wed (Tue and Wed peak). */
function section4(over: { omitP2Day1?: boolean } = {}): { view: HostView; hist: HostHistories } {
  const profit: Record<string, number[]> = { P1: [100, -10, 40.25], P2: [80, 30, 20] }
  const spoiled: Record<string, number[]> = { P1: [2, 0, 1], P2: [0, 3, 1] }
  const share: Record<string, number[]> = { P1: [0.5, 0.4, 0.55], P2: [0.5, 0.6, 0.45] }
  const mult = [0.5, 1, 1]
  const wd = ['mon', 'tue', 'wed']
  const players: Obj = {}
  const records: Obj = {}
  for (const a of ['P1', 'P2']) {
    players[a] = { display_name: M2[a], has_submitted: false }
    records[a] = [0, 1, 2]
      .filter((i) => !(over.omitP2Day1 && a === 'P2' && i === 0))
      .map((i) => rec(i + 1, { profit: profit[a][i], spoiled: spoiled[a][i] }))
  }
  const publicHistory = [0, 1, 2].map((i) => {
    const p: Obj = {}
    for (const a of ['P1', 'P2']) p[a] = { display_name: M2[a], units_sold: 10, market_share: share[a][i], reputation: 0.5 + i / 10 }
    return { ...pub(i + 1), players: p } as unknown as PublicDayResults
  })
  const marketHistory = [0, 1, 2].map((i) => market(i + 1, { weekday: wd[i], weekday_multiplier: mult[i] }))
  return {
    view: hostView(true, { players }),
    // the server's profit so far after each day (host_view cumulative_profit_by_day, spec §12.5)
    hist: { players: records, race: { P1: [100, 90, 130.25], P2: [80, 110, 130] }, publicHistory, marketHistory } as unknown as HostHistories,
  }
}

function scenario(n: number): { view: HostView; hist: HostHistories } {
  const players: Obj = {}
  const records: Obj = {}
  for (let k = 1; k <= n; k++) {
    players[`P${k}`] = { display_name: `Name ${k}`, has_submitted: false }
    records[`P${k}`] = [rec(1, { profit: k, spoiled: k }), rec(2, { profit: k, spoiled: k })]
  }
  const p: Obj = {}
  for (let k = 1; k <= n; k++) p[`P${k}`] = { display_name: `Name ${k}`, units_sold: 1, market_share: 1 / n, reputation: 0.5 }
  return {
    view: hostView(true, { players }),
    hist: {
      players: records,
      race: Object.fromEntries(Object.keys(records).map((a, k) => [a, [k + 1, 2 * (k + 1)]])),
      publicHistory: [1, 2].map((d) => ({ ...pub(d), players: p }) as unknown as PublicDayResults),
      marketHistory: [market(1), market(2)],
    } as unknown as HostHistories,
  }
}

function mount(s: { view: HostView; hist: HostHistories }) {
  return render(<MarketCharts hostView={s.view} histories={s.hist} config={s.view.config as GameConfig} />)
}

const col = (table: HTMLElement, header: string): string[] => {
  const heads = within(table).getAllByRole('columnheader').map((h) => (h.textContent ?? '').trim())
  const i = heads.indexOf(header)
  if (i < 0) throw new Error(`no column ${header}: ${heads.join('|')}`)
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((r) => (r.querySelectorAll('th, td')[i]?.textContent ?? '').trim())
}

const fig = (title: string): HTMLElement => {
  const f = screen.getAllByRole('figure').find((el) => (el.querySelector('figcaption')?.textContent ?? '').includes(title))
  if (!f) throw new Error(`no chart ${title}`)
  return f
}
const chart = (title: string): { data: { labels: unknown[]; datasets: Obj[] }; options: Obj } =>
  JSON.parse(fig(title).querySelector('[data-testid^="chart-"]')!.getAttribute('data-chart')!)
const table = (title: string): HTMLElement => {
  fireEvent.click(within(fig(title)).getByRole('button', { name: 'Show table' }))
  return within(fig(title)).getByRole('table', { name: title })
}
const legendItem = (title: string, label: string): HTMLElement =>
  within(fig(title)).getAllByText(label).map((e) => e.closest('li')).find(Boolean) as HTMLElement

describe('Profit race (plan 37 §3.3, acceptance 3, 6, failure mode 3)', () => {
  it('is the first chart, ahead of Market share, with its accessible name', () => {
    mount(section4())
    const figures = screen.getAllByRole('figure')
    expect(figures[0].textContent).toContain('Profit race')
    expect(figures[1].textContent).toContain('Market share')
    expect(
      within(figures[0]).getByRole('img', { name: "Line chart of each pulquería's running profit on each day played so far" }),
    ).toBeInTheDocument()
  })

  it("plots the server's running profit per day (worked example) and nothing else", () => {
    mount(section4())
    const c = chart('Profit race')
    expect(c.data.datasets.map((d) => d.label)).toEqual(['Don Agave', 'La Chula'])
    expect(c.data.datasets[0].data).toEqual([100, 90, 130.25])
    expect(c.data.datasets[1].data).toEqual([80, 110, 130])
  })

  it('failure mode 3: there is no End point, exactly one label per closed day', () => {
    mount(section4())
    const c = chart('Profit race')
    expect(c.data.labels).toEqual([['1', 'Mon'], ['2', 'Tue'], ['3', 'Wed']])
    for (const d of c.data.datasets) expect(d.data).toHaveLength(3)
    expect(JSON.stringify(c.data.labels)).not.toContain('End')
  })

  it('shades the days whose weekday multiplier is 1', () => {
    mount(section4())
    const plugins = chart('Profit race').options.plugins as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(plugins.eventBands.bands).toEqual([
      { index: 1, tone: 'peak' },
      { index: 2, tone: 'peak' },
    ])
  })

  it('acceptance 3: its day points equal the results race for the same records', () => {
    const s = section4()
    mount(s)
    const cumulative = { P1: [100, 90, 130.25], P2: [80, 110, 130] } as Record<string, number[]>
    const view = {
      days_played: 3,
      market: { weekday: ['mon', 'tue', 'wed'], weekday_multiplier: [0.5, 1, 1] },
      players: ['P1', 'P2'].map((a) => ({ alias: a, display_name: M2[a], series: { cumulative_profit: cumulative[a] }, total_profit: 999 })),
    } as never
    const results = buildProfitRaceConfig(view, null) as unknown as { data: { datasets: Array<{ data: number[] }> } }
    chart('Profit race').data.datasets.forEach((d, i) => expect(d.data).toEqual(results.data.datasets[i].data.slice(0, 3)))
  })

  it('table: Day then one column per pulquería with the running totals in money', () => {
    mount(section4())
    const t = table('Profit race')
    const heads = within(t).getAllByRole('columnheader').map((h) => h.textContent?.trim())
    expect(heads).toEqual(['Day', 'Don Agave', 'La Chula'])
    expect(col(t, 'Don Agave')).toEqual(['$100.00', '$90.00', '$130.25'])
    expect(col(t, 'La Chula')).toEqual(['$80.00', '$110.00', '$130.00'])
  })

  it('legend: a line item per pulquería, dashed from P7', () => {
    mount(scenario(7))
    const items = Array.from(fig('Profit race').querySelectorAll('li'))
    expect(items.map((li) => li.textContent?.trim())).toEqual(Array.from({ length: 7 }, (_, i) => `Name ${i + 1}`))
    items.forEach((li, i) => {
      const dash = li.querySelector('line')?.getAttribute('stroke-dasharray')
      if (i < 6) expect(dash ?? '').toBe('')
      else expect(dash).toBe('6 4')
    })
  })

  it('hovering a legend item emphasises that line and leaving clears it', () => {
    mount(section4())
    fireEvent.pointerEnter(legendItem('Profit race', 'La Chula'))
    const on = chart('Profit race').data.datasets
    expect(on[1]).toMatchObject(pulqueriaLine('P2', 'focus'))
    expect(on[0]).toMatchObject(pulqueriaLine('P1', 'context'))
    fireEvent.pointerLeave(legendItem('Profit race', 'La Chula'))
    chart('Profit race').data.datasets.forEach((d, i) => expect(d).toMatchObject(pulqueriaLine(`P${i + 1}`, 'none')))
  })
})

describe('Reputation emphasis (plan 37 §3.3, acceptance 5, failure mode 4)', () => {
  const styles = () => chart('Reputation').data.datasets

  it('with nothing hovered every line has its normal (none) style', () => {
    mount(section4())
    styles().forEach((d, i) => expect(d).toMatchObject(pulqueriaLine(`P${i + 1}`, 'none')))
  })

  it('hovering a legend item focuses that line and puts the others in context', () => {
    mount(section4())
    fireEvent.pointerEnter(legendItem('Reputation', 'Don Agave'))
    expect(styles()[0]).toMatchObject(pulqueriaLine('P1', 'focus'))
    expect(styles()[1]).toMatchObject(pulqueriaLine('P2', 'context'))
  })

  it('focusing a legend item does the same', () => {
    mount(section4())
    fireEvent.focus(legendItem('Reputation', 'La Chula'))
    expect(styles()[1]).toMatchObject(pulqueriaLine('P2', 'focus'))
    expect(styles()[0]).toMatchObject(pulqueriaLine('P1', 'context'))
  })

  it('failure mode 4: after the pointer leaves, every line is back to none', () => {
    mount(section4())
    fireEvent.pointerEnter(legendItem('Reputation', 'Don Agave'))
    fireEvent.pointerLeave(legendItem('Reputation', 'Don Agave'))
    styles().forEach((d, i) => expect(d).toMatchObject(pulqueriaLine(`P${i + 1}`, 'none')))
  })

  it('failure mode 4: after blur, every line is back to none', () => {
    mount(section4())
    fireEvent.focus(legendItem('Reputation', 'Don Agave'))
    fireEvent.blur(legendItem('Reputation', 'Don Agave'))
    styles().forEach((d, i) => expect(d).toMatchObject(pulqueriaLine(`P${i + 1}`, 'none')))
  })

  it('keeps its data and its table', () => {
    mount(section4())
    expect(styles().map((d) => d.data)).toEqual([[0.5, 0.6, 0.7], [0.5, 0.6, 0.7]])
    expect(table('Reputation')).toBeInTheDocument()
  })
})

describe('Spoilage per day stacked by pulquería (plan 37 §3.3, acceptance 2, failure mode 2)', () => {
  it('has one dataset per pulquería with the spoiled units per day, stacked, y titled Units', () => {
    mount(section4())
    const c = chart('Spoilage per day')
    expect(c.data.datasets.map((d) => d.label)).toEqual(['Don Agave', 'La Chula'])
    expect(c.data.datasets[0].data).toEqual([2, 0, 1])
    expect(c.data.datasets[1].data).toEqual([0, 3, 1])
    const scales = c.options.scales as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(scales.x.stacked).toBe(true)
    expect(scales.y.stacked).toBe(true)
    expect(scales.y.title.text).toBe('Units')
  })

  it('failure mode 2: the datasets sum, day by day, to 2, 3, 2', () => {
    mount(section4())
    const ds = chart('Spoilage per day').data.datasets
    const sums = [0, 1, 2].map((i) => ds.reduce((s, d) => s + ((d.data as Array<number | null>)[i] ?? 0), 0))
    expect(sums).toEqual([2, 3, 2])
  })

  it('failure mode 2: the table Total column reads 2, 3, 2', () => {
    mount(section4())
    const t = table('Spoilage per day')
    expect(within(t).getAllByRole('columnheader').map((h) => h.textContent?.trim())).toEqual(['Day', 'Don Agave', 'La Chula', 'Total'])
    expect(col(t, 'Total')).toEqual(['2', '3', '2'])
    expect(col(t, 'Don Agave')).toEqual(['2', '0', '1'])
    expect(col(t, 'La Chula')).toEqual(['0', '3', '1'])
  })

  it('a day with no record for a pulquería is null in the data and a dash in the table', () => {
    mount(section4({ omitP2Day1: true }))
    expect(chart('Spoilage per day').data.datasets[1].data).toEqual([null, 3, 1])
    const t = table('Spoilage per day')
    expect(col(t, 'La Chula')).toEqual(['—', '3', '1'])
    expect(col(t, 'Total')).toEqual(['2', '3', '2'])
  })

  it('colours the stacks as the share bars: the pulquería colour, hatched from P7', () => {
    mount(scenario(7))
    const ds = chart('Spoilage per day').data.datasets
    expect(ds).toHaveLength(7)
    ds.forEach((d, i) => {
      if (i < 6) expect(d.backgroundColor).toBe(pulqueriaStyle(`P${i + 1}`).color)
      else expect(d.backgroundColor).toBe('__fn__')
    })
  })

  it('legend: one fill item per pulquería, hatched from P7', () => {
    mount(scenario(7))
    const items = Array.from(fig('Spoilage per day').querySelectorAll('li'))
    expect(items.map((li) => li.textContent?.trim())).toEqual(Array.from({ length: 7 }, (_, i) => `Name ${i + 1}`))
    items.forEach((li, i) => expect(li.querySelector('pattern') !== null).toBe(i >= 6))
  })

  it('orders pulquerías by alias number', () => {
    const s = scenario(2)
    const v = s.view as unknown as { players: Obj }
    v.players.P10 = { display_name: 'Diez', has_submitted: false }
    ;(s.hist.players as unknown as Obj).P10 = [rec(1, { spoiled: 4 }), rec(2, { spoiled: 4 })]
    mount(s)
    expect(chart('Spoilage per day').data.datasets.map((d) => d.label)).toEqual(['Name 1', 'Name 2', 'Diez'])
  })
})
