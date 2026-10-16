/** Section 28 — PresentationMode (plan 28 §3.7, §4). Acceptance 7, 8; failure modes 1, 2, 3, 8. */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-chartjs-2', () => ({
  Bar: () => <canvas />,
  Line: () => <canvas />,
  Pie: () => <canvas />,
  Doughnut: () => <canvas />,
}))

import PresentationMode from '../components/host/PresentationMode'
import { selectPresentationData, type PresentationData } from '../components/host/presentationData'
import { INITIAL_STATE, useGameStore } from '../store/gameStore'
import type { Brief, HostView, PublicDayResults } from '../types/game'

const NAMES: Record<string, string> = { P1: 'Don Agave', P2: 'La Chula', P3: 'El Tinacal' }

function brief(over: Record<string, unknown> = {}): Brief {
  return {
    day: 5,
    duration_days: 14,
    weekday: 'fri',
    weekday_multiplier: 1,
    weekday_multipliers: { mon: 0.25, tue: 0.5, wed: 0.75, thu: 1, fri: 1, sat: 1, sun: 0.75 },
    expected_demand: 100,
    supplier: { capacity: 81, disrupted: false, disruption_message: null, spot_price: 13.4, base_price: 12, lead_time_days: 1 },
    spot: { open: true, arrives_day: 6 },
    futures: { open: true, price: 12, horizon_days: 7, delivery_day: 12, last_day_to_buy: 7, days_left_to_buy: 3 },
    transport: { shared: false },
    reputation: { P1: 0.62, P2: 0.55, P3: 0.5 },
    ...over,
  } as unknown as Brief
}

function pub(over: Record<string, unknown> = {}): PublicDayResults {
  return {
    day: 4,
    weekday: 'thu',
    demand_total: 100,
    units_sold_total: 90,
    spot_price: 13.4,
    capacity: 81,
    disrupted: false,
    cooperation: false,
    cooperators: 1,
    refrigeration_failure: false,
    peer_units: 16,
    peer_avg_price: 14.25,
    players: {
      P1: { display_name: 'Don Agave', units_sold: 31, market_share: 0.35, reputation: 0.62 },
      P2: { display_name: 'La Chula', units_sold: 27, market_share: 0.3, reputation: 0.55 },
      P3: { display_name: 'El Tinacal', units_sold: 32, market_share: 0.35, reputation: 0.5 },
    },
    ...over,
  } as unknown as PublicDayResults
}

function data(over: Partial<PresentationData> = {}): PresentationData {
  const b = brief()
  return {
    day: 5,
    durationDays: 14,
    weekday: 'fri',
    isPeak: true,
    brief: {
      expected_demand: b.expected_demand,
      supplier: b.supplier,
      futures: b.futures,
      transport: b.transport,
    },
    latest: pub(),
    peerMarket: true,
    submitted: [
      { alias: 'P1', displayName: 'Don Agave', submitted: true },
      { alias: 'P2', displayName: 'La Chula', submitted: true },
      { alias: 'P3', displayName: 'El Tinacal', submitted: false },
    ],
    ...over,
  }
}

const setBrief = (patch: Record<string, unknown>): PresentationData['brief'] => {
  const b = brief(patch)
  return { expected_demand: b.expected_demand, supplier: b.supplier, futures: b.futures, transport: b.transport }
}

/** Elements whose whole normalised text is exactly `text` (structure-agnostic). */
function exactText(text: string): Element[] {
  return Array.from(document.body.querySelectorAll('*')).filter(
    (el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim() === text,
  )
}

const bodyText = (): string => (document.body.textContent ?? '').replace(/\s+/g, ' ')

beforeEach(() => {
  useGameStore.setState({ ...INITIAL_STATE })
})

describe('PresentationMode shell', () => {
  it('sets data-scale="presentation" on <html> on mount and removes it on unmount', () => {
    expect(document.documentElement.getAttribute('data-scale')).toBeNull()
    const { unmount } = render(<PresentationMode data={data()} onExit={() => {}} />)
    expect(document.documentElement.getAttribute('data-scale')).toBe('presentation')
    unmount()
    expect(document.documentElement.getAttribute('data-scale')).toBeNull()
  })

  it('Exit calls onExit', () => {
    const onExit = vi.fn()
    render(<PresentationMode data={data()} onExit={onExit} />)
    fireEvent.click(screen.getByRole('button', { name: /Exit/ }))
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('Escape calls onExit', () => {
    const onExit = vi.fn()
    render(<PresentationMode data={data()} onExit={onExit} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('other keys do not exit', () => {
    const onExit = vi.fn()
    render(<PresentationMode data={data()} onExit={onExit} />)
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(onExit).not.toHaveBeenCalled()
  })
})

describe('PresentationMode header and brief tiles', () => {
  it('shows Day {day} · {Weekday} and the Peak day chip on a peak day', () => {
    render(<PresentationMode data={data()} onExit={() => {}} />)
    expect(screen.getByText('Day 5 · Friday')).toBeInTheDocument()
    expect(screen.getByText('Peak day')).toBeInTheDocument()
  })

  it('has no Peak day chip when isPeak is false', () => {
    render(<PresentationMode data={data({ isPeak: false, weekday: 'mon', day: 1 })} onExit={() => {}} />)
    expect(screen.getByText('Day 1 · Monday')).toBeInTheDocument()
    expect(screen.queryByText('Peak day')).toBeNull()
  })

  it('shows the four brief tiles with their values', () => {
    render(<PresentationMode data={data()} onExit={() => {}} />)
    for (const label of ['Expected demand', 'Spot price', 'Supplier capacity', 'Futures']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.getByText('~100')).toBeInTheDocument()
    expect(screen.getByText('$13.40')).toBeInTheDocument()
    expect(screen.getByText('81')).toBeInTheDocument()
  })

  it('shows the disruption message as a sub-line only when there is one', () => {
    const msg = 'Day 5 (Fri): supplier capacity cut to 40%'
    const { unmount } = render(
      <PresentationMode
        data={data({ brief: setBrief({ supplier: { capacity: 32, disrupted: true, disruption_message: msg, spot_price: 13.4, base_price: 12, lead_time_days: 1 } }) })}
        onExit={() => {}}
      />,
    )
    expect(screen.getByText(msg)).toBeInTheDocument()
    unmount()
    render(<PresentationMode data={data()} onExit={() => {}} />)
    expect(screen.queryByText(/supplier capacity cut/)).toBeNull()
  })

  it.each([
    [3, '3 days left to buy'],
    [2, '2 days left to buy'],
    [1, 'Last day to buy futures'],
    [0, 'Futures closed'],
  ])('futures with %i days left reads "%s"', (left, copy) => {
    const futures = { open: left > 0, price: 12, horizon_days: 7, delivery_day: 12, last_day_to_buy: 7, days_left_to_buy: left }
    render(<PresentationMode data={data({ brief: setBrief({ futures }) })} onExit={() => {}} />)
    expect(screen.getByText(copy)).toBeInTheDocument()
  })

  it('uses the short projector labels, not the long spec window copy', () => {
    render(<PresentationMode data={data()} onExit={() => {}} />)
    expect(bodyText()).not.toContain('delivery in')
    expect(bodyText()).not.toContain('deliveries would arrive')
  })
})

describe('PresentationMode yesterday and alerts', () => {
  it('lists each pulquería with units sold and share', () => {
    render(<PresentationMode data={data()} onExit={() => {}} />)
    const table = screen.getByRole('table')
    for (const h of ['Pulquería', 'Sold', 'Share', 'Reputation']) {
      expect(within(table).getByRole('columnheader', { name: h })).toBeInTheDocument()
    }
    const row = within(table).getByRole('row', { name: /La Chula/ })
    expect(row).toHaveTextContent('27')
    expect(row).toHaveTextContent(/30(\.0)?%/)
    expect(within(table).getByRole('row', { name: /Don Agave/ })).toHaveTextContent(/35(\.0)?%/)
  })

  it('shows No results yet. before day 1 closes, with no table', () => {
    render(<PresentationMode data={data({ latest: null, day: 1, weekday: 'mon', isPeak: false })} onExit={() => {}} />)
    expect(screen.getByText('No results yet.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('shows the refrigeration alert only after a failure', () => {
    const { unmount } = render(
      <PresentationMode data={data({ latest: pub({ refrigeration_failure: true }) })} onExit={() => {}} />,
    )
    expect(screen.getByText('Refrigeration failed yesterday.')).toBeInTheDocument()
    unmount()
    render(<PresentationMode data={data()} onExit={() => {}} />)
    expect(screen.queryByText('Refrigeration failed yesterday.')).toBeNull()
  })

  it('shows the cooperation alert only after a cooperation day', () => {
    const { unmount } = render(
      <PresentationMode data={data({ latest: pub({ cooperation: true }) })} onExit={() => {}} />,
    )
    expect(screen.getByText('Everyone cooperated yesterday.')).toBeInTheDocument()
    unmount()
    render(<PresentationMode data={data()} onExit={() => {}} />)
    expect(screen.queryByText('Everyone cooperated yesterday.')).toBeNull()
  })
})

describe('PresentationMode peer totals', () => {
  it('shows the public peer totals line when the peer market is on', () => {
    render(<PresentationMode data={data()} onExit={() => {}} />)
    expect(bodyText()).toContain('Peer market: 16 units at $14.25 on average')
  })

  it('shows the no-trades variant at 0 units and never a $0.00 price', () => {
    render(<PresentationMode data={data({ latest: pub({ peer_units: 0, peer_avg_price: null }) })} onExit={() => {}} />)
    expect(bodyText()).toContain('Peer market: no trades')
    expect(bodyText()).not.toContain('$0.00')
  })

  it('shows no peer line when the peer market is off', () => {
    render(<PresentationMode data={data({ peerMarket: false })} onExit={() => {}} />)
    expect(bodyText()).not.toContain('Peer market')
  })
})

describe('PresentationMode submissions', () => {
  it('shows one chip per pulquería with its name and state word (failure mode 3)', () => {
    render(<PresentationMode data={data()} onExit={() => {}} />)
    expect(exactText('Don Agave submitted').length).toBeGreaterThan(0)
    expect(exactText('La Chula submitted').length).toBeGreaterThan(0)
    expect(exactText('El Tinacal deciding').length).toBeGreaterThan(0)
    expect(screen.getByText('Submissions')).toBeInTheDocument()
  })
})

describe('PresentationMode leaks nothing private (failure modes 1, 2, 3, 8)', () => {
  const PRIVATE = [
    '6,120.55',
    '6120.55',
    '1,120.55',
    '1120.55',
    '987654321',
    '987,654,321',
    '0.1234',
    '12.34%',
    '0.337',
    '33.7%',
    '7.96',
    '16.04',
    '13.31',
    '17.77',
    'Don Agave sold',
    'La Chula sold',
    'sold 10 to',
  ]

  /** The §4 state: private values in the host view, the player records and the config. */
  function seedPrivateState(): void {
    const players: Record<string, unknown> = {}
    for (const [a, name] of Object.entries(NAMES)) {
      players[a] = {
        display_name: name,
        connected: true,
        has_submitted: a !== 'P3',
        stock_units: 42,
        cash: 6120.55,
        cumulative_profit: 1120.55,
        fill_rate: 0.9,
        waste_rate: 0.1,
        last_incoterm: 'cip',
        last_peer_bought: 10,
        last_peer_sold: 4,
      }
    }
    const hostView = {
      full: true,
      state: 'running',
      day: 5,
      duration_days: 14,
      weekday: 'fri',
      phase: 'deciding',
      brief: brief(),
      seed: 987654321,
      config: {
        random_seed: 987654321,
        peer_market: { enabled: true },
        supplier: { base_price: 12, spot_spread: 0.337 },
        transport: { failure_probability: 0.1234 },
      },
      awaiting: ['P3'],
      players,
      leaderboard: [],
    } as unknown as HostView
    useGameStore.setState({
      ...INITIAL_STATE,
      roomCode: 'ABC234',
      isHost: true,
      hostClaimed: true,
      roomState: 'running',
      brief: brief(),
      hostView,
      publicHistory: [pub({ day: 3 }), pub({ day: 4 })],
      marketHistory: [],
      hostHistories: {
        P1: [
          {
            day: 4,
            peer_trades: [{ side: 'sell', counterparty: 'P2', lot_id: 'L4', qty: 10, quality: 62, price: 13.31 }],
            cash_end: 6120.55,
            profit: 1120.55,
          } as never,
        ],
        P2: [
          {
            day: 4,
            peer_buy: { max_price: 17.77, min_quality: 50 },
            peer_trades: [{ side: 'buy', counterparty: 'P1', lot_id: 'B4-1', qty: 10, quality: 62, price: 13.31 }],
          } as never,
        ],
      },
    })
  }

  it('renders none of the private values for the selector output of the §4 state', () => {
    seedPrivateState()
    const selected = selectPresentationData(useGameStore.getState())!
    render(<PresentationMode data={selected} onExit={() => {}} />)
    const text = bodyText()
    for (const value of PRIVATE) expect(text, value).not.toContain(value)
    expect(text).toContain('Peer market: 16 units at $14.25 on average')
  })

  it('does not read the store or the host view itself', () => {
    seedPrivateState()
    // clean data that names nobody: anything private on screen must have come from the store
    render(
      <PresentationMode data={data({ submitted: [], latest: null, peerMarket: false })} onExit={() => {}} />,
    )
    const text = bodyText()
    for (const value of PRIVATE) expect(text, value).not.toContain(value)
    expect(text).not.toContain('Don Agave')
  })

  it('shows only the public columns of each result row, whatever else a player entry carries', () => {
    const polluted = pub({
      players: {
        P1: { display_name: 'Don Agave', units_sold: 31, market_share: 0.35, reputation: 0.62, cash: 6120.55, profit: 1120.55 },
      },
    })
    render(<PresentationMode data={data({ latest: polluted })} onExit={() => {}} />)
    const text = bodyText()
    expect(text).not.toContain('6,120.55')
    expect(text).not.toContain('1,120.55')
    expect(text).not.toContain('6120.55')
  })
})
