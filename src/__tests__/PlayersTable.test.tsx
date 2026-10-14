/** Section 28 — PlayersTable (plan 28 §3.4, spec §11.4). Acceptance 3; failure modes 10 (and 3). */
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import PlayersTable from '../components/host/PlayersTable'
import type { HostHistories } from '../components/host/presentationData'
import type { DayRecord, HostView } from '../types/game'

const LEAF_ON = [
  'Pulquería',
  'Connected',
  'Submitted',
  'On hand',
  'Spoiling tonight',
  'In transit',
  'Open futures',
  'Backlog',
  'Reputation',
  'Share',
  'Bought',
  'Sold',
  'Profit',
  'Cash',
  'Waste rate',
  'Fill rate',
  'Last tier',
]
const LEAF_OFF = LEAF_ON.filter((h) => h !== 'Bought' && h !== 'Sold')

type Row = Record<string, unknown>

function player(name: string, over: Row = {}): Row {
  return {
    display_name: name,
    connected: true,
    has_submitted: true,
    stock_units: 42,
    expected_spoil_tonight: 3.4,
    in_transit_units: 30,
    open_futures_units: 25,
    backlog: 0,
    reputation: 0.6249,
    market_share: 0.25,
    cumulative_profit: 1120.55,
    cash: 6120.55,
    fill_rate: 0.9,
    waste_rate: 0.05,
    last_incoterm: 'cip',
    last_peer_bought: 10,
    last_peer_sold: 4,
    ...over,
  }
}

function view(peer: boolean, players: Record<string, Row>): HostView {
  return {
    full: true,
    state: 'running',
    day: 5,
    duration_days: 14,
    weekday: 'fri',
    phase: 'deciding',
    seed: 1,
    config: { peer_market: { enabled: peer } },
    awaiting: [],
    players,
    leaderboard: [],
  } as unknown as HostView
}

function histories(players: Record<string, Array<Record<string, unknown>>> = {}): HostHistories {
  return { players: players as unknown as Record<string, DayRecord[]>, publicHistory: [], marketHistory: [] }
}

const DEFAULT_PLAYERS = {
  P1: player('Don Agave'),
  P2: player('La Chula', {
    connected: false,
    has_submitted: false,
    expected_spoil_tonight: 7,
    backlog: 12,
    fill_rate: null,
    last_incoterm: null,
    last_peer_bought: null,
    last_peer_sold: null,
  }),
}

function leafHeaders(): string[] {
  const table = screen.getByRole('table', { name: 'Pulquerías' })
  const rows = table.querySelectorAll('thead tr')
  const last = rows[rows.length - 1]
  return Array.from(last.querySelectorAll('th')).map((th) => (th.textContent ?? '').trim())
}

/** The text of one cell: the row of a pulquería, the column by its leaf header. */
function cell(name: string, header: string): HTMLElement {
  const headers = leafHeaders()
  const idx = headers.indexOf(header)
  if (idx < 0) throw new Error(`no column ${header}`)
  const table = screen.getByRole('table', { name: 'Pulquerías' })
  const row = within(table).getByRole('row', { name: new RegExp(name) })
  return Array.from(row.querySelectorAll('th, td'))[idx] as HTMLElement
}

describe('PlayersTable structure', () => {
  it('is a table captioned Pulquerías with the spec columns in order, peer on', () => {
    render(<PlayersTable hostView={view(true, DEFAULT_PLAYERS)} histories={histories()} />)
    expect(leafHeaders()).toEqual(LEAF_ON)
  })

  it('has the five column groups when the peer market is on', () => {
    render(<PlayersTable hostView={view(true, DEFAULT_PLAYERS)} histories={histories()} />)
    for (const g of ['Stock', 'Market', 'Peer market', 'Money', 'Rates']) {
      expect(screen.getByRole('columnheader', { name: g })).toBeInTheDocument()
    }
  })

  it('failure/acceptance 3: the Peer market group and its Bought and Sold columns are absent when the peer market is off', () => {
    render(<PlayersTable hostView={view(false, DEFAULT_PLAYERS)} histories={histories()} />)
    expect(leafHeaders()).toEqual(LEAF_OFF)
    expect(screen.queryByRole('columnheader', { name: 'Peer market' })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: 'Bought' })).toBeNull()
    for (const g of ['Stock', 'Market', 'Money', 'Rates']) {
      expect(screen.getByRole('columnheader', { name: g })).toBeInTheDocument()
    }
  })

  it('has one row per pulquería', () => {
    render(<PlayersTable hostView={view(true, DEFAULT_PLAYERS)} histories={histories()} />)
    const body = screen.getByRole('table', { name: 'Pulquerías' }).querySelectorAll('tbody tr')
    expect(body).toHaveLength(2)
  })
})

describe('PlayersTable cells', () => {
  it('shows connection and submission as yes / no words', () => {
    render(<PlayersTable hostView={view(true, DEFAULT_PLAYERS)} histories={histories()} />)
    expect(cell('Don Agave', 'Connected')).toHaveTextContent('yes')
    expect(cell('La Chula', 'Connected')).toHaveTextContent('no')
    expect(cell('Don Agave', 'Submitted')).toHaveTextContent('yes')
    expect(cell('La Chula', 'Submitted')).toHaveTextContent('no')
  })

  it('shows the stock figures, spoilage with one decimal', () => {
    render(<PlayersTable hostView={view(true, DEFAULT_PLAYERS)} histories={histories()} />)
    expect(cell('Don Agave', 'On hand')).toHaveTextContent('42')
    expect(cell('Don Agave', 'Spoiling tonight')).toHaveTextContent('3.4')
    expect(cell('La Chula', 'Spoiling tonight')).toHaveTextContent('7.0')
    expect(cell('Don Agave', 'In transit')).toHaveTextContent('30')
    expect(cell('Don Agave', 'Open futures')).toHaveTextContent('25')
  })

  it('shows reputation with two decimals and the share as a percent', () => {
    render(<PlayersTable hostView={view(true, DEFAULT_PLAYERS)} histories={histories()} />)
    expect(cell('Don Agave', 'Reputation')).toHaveTextContent('0.62')
    expect(cell('Don Agave', 'Share')).toHaveTextContent(/25(\.0)?%/)
  })

  it('shows profit and cash as money', () => {
    render(<PlayersTable hostView={view(true, DEFAULT_PLAYERS)} histories={histories()} />)
    expect(cell('Don Agave', 'Profit')).toHaveTextContent('$1,120.55')
    expect(cell('Don Agave', 'Cash')).toHaveTextContent('$6,120.55')
  })

  it('shows waste and fill as percents, a null fill rate as a dash, and the tier upper-case', () => {
    render(<PlayersTable hostView={view(true, DEFAULT_PLAYERS)} histories={histories()} />)
    expect(cell('Don Agave', 'Waste rate')).toHaveTextContent(/5(\.0)?%/)
    expect(cell('Don Agave', 'Fill rate')).toHaveTextContent(/90(\.0)?%/)
    expect(cell('Don Agave', 'Last tier')).toHaveTextContent('CIP')
    expect(cell('La Chula', 'Fill rate').textContent?.trim()).toBe('—')
    expect(cell('La Chula', 'Last tier').textContent?.trim()).toBe('—')
  })

  it('marks a backlog above zero with the ClockAlert icon and only then', () => {
    render(<PlayersTable hostView={view(true, DEFAULT_PLAYERS)} histories={histories()} />)
    expect(cell('La Chula', 'Backlog')).toHaveTextContent('12')
    expect(cell('La Chula', 'Backlog').querySelector('svg.lucide-clock-alert')).not.toBeNull()
    expect(cell('Don Agave', 'Backlog').querySelector('svg.lucide-clock-alert')).toBeNull()
  })

  it('shows Wifi / WifiOff beside the connection word', () => {
    render(<PlayersTable hostView={view(true, DEFAULT_PLAYERS)} histories={histories()} />)
    expect(cell('Don Agave', 'Connected').querySelector('svg.lucide-wifi')).not.toBeNull()
    expect(cell('La Chula', 'Connected').querySelector('svg.lucide-wifi-off')).not.toBeNull()
  })
})

describe('PlayersTable peer columns', () => {
  it('shows the last resolved day bought and sold units', () => {
    render(<PlayersTable hostView={view(true, DEFAULT_PLAYERS)} histories={histories()} />)
    expect(cell('Don Agave', 'Bought').textContent?.trim()).toBe('10')
    expect(cell('Don Agave', 'Sold').textContent?.trim()).toBe('4')
  })

  it('failure mode 10: null peer values read a dash, never 0', () => {
    render(<PlayersTable hostView={view(true, DEFAULT_PLAYERS)} histories={histories()} />)
    expect(cell('La Chula', 'Bought').textContent?.trim()).toBe('—')
    expect(cell('La Chula', 'Sold').textContent?.trim()).toBe('—')
  })

  it('a real zero is shown as 0, so the dash means "not resolved yet"', () => {
    const players = { P1: player('Don Agave', { last_peer_bought: 0, last_peer_sold: 0 }) }
    render(<PlayersTable hostView={view(true, players)} histories={histories()} />)
    expect(cell('Don Agave', 'Bought').textContent?.trim()).toBe('0')
    expect(cell('Don Agave', 'Sold').textContent?.trim()).toBe('0')
  })
})

describe('PlayersTable refrigeration marker', () => {
  const SR = 'refrigeration failure yesterday'

  it('flags a pulquería whose last record lost units in transport', () => {
    render(
      <PlayersTable
        hostView={view(true, DEFAULT_PLAYERS)}
        histories={histories({ P1: [{ day: 3, lost_transport: 0 }, { day: 4, lost_transport: 15 }] })}
      />,
    )
    const own = cell('Don Agave', 'Pulquería')
    expect(within(own).getByText(SR)).toBeInTheDocument()
    expect(own.querySelector('svg.lucide-thermometer-sun')).not.toBeNull()
    expect(within(cell('La Chula', 'Pulquería')).queryByText(SR)).toBeNull()
    expect(screen.getAllByText(SR)).toHaveLength(1)
  })

  it('looks only at the last record: an older failure is not flagged', () => {
    render(
      <PlayersTable
        hostView={view(true, DEFAULT_PLAYERS)}
        histories={histories({ P1: [{ day: 3, lost_transport: 15 }, { day: 4, lost_transport: 0 }] })}
      />,
    )
    expect(screen.queryByText(SR)).toBeNull()
  })

  it('shows no marker without any record', () => {
    render(<PlayersTable hostView={view(true, DEFAULT_PLAYERS)} histories={histories()} />)
    expect(screen.queryByText(SR)).toBeNull()
  })
})
