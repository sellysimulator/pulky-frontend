/**
 * Section 30 - GamesTable (spec 13.8 reuse; plan 3.2).
 * Acceptance criteria 2 (games table columns and formats), 3 (newest first, Open links).
 */
import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import GamesTable from '../components/profile/GamesTable'
import type { MyGameRow } from '../types/game'
import { formatMoney } from '../utils/format'

function row(over: Partial<MyGameRow>): MyGameRow {
  return {
    game_id: 'g-default',
    room_code: 'ABC234',
    finished_at: '2026-10-12T18:30:00Z',
    days_played: 14,
    duration_days: 14,
    player_count: 3,
    ended_early: false,
    alias: 'P1',
    display_name: 'Don Agave',
    rank: 1,
    total_profit: 100,
    ...over,
  }
}

const EXAMPLE = row({
  game_id: 'g-example',
  room_code: 'QWE567',
  rank: 2,
  player_count: 4,
  days_played: 9,
  duration_days: 14,
  ended_early: true,
  total_profit: 1234.5,
  finished_at: '2026-10-12T18:30:00Z',
  display_name: 'La Chula',
})

function mount(games: MyGameRow[]) {
  const router = createMemoryRouter([{ path: '*', element: <GamesTable games={games} /> }], { initialEntries: ['/profile'] })
  return render(<RouterProvider router={router} />)
}

const bodyRows = () => screen.getAllByRole('row').slice(1)

describe('GamesTable columns and formats', () => {
  it('has the caption and the seven headers of the spec', () => {
    mount([EXAMPLE])
    const table = screen.getByRole('table', { name: 'Your games' })
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent)
    expect(headers.slice(0, 6)).toEqual(['Date', 'Room', 'Pulquería', 'Rank', 'Profit', 'Days'])
    expect(headers).toHaveLength(7)
  })

  it('renders the worked example: 12 Oct 2026, 2 of 4, 9/14 + Ended early, $1,234.50', () => {
    mount([EXAMPLE])
    const r = bodyRows()[0]
    expect(within(r).getByText('12 Oct 2026')).toBeInTheDocument()
    expect(within(r).getByText('2 of 4')).toBeInTheDocument()
    expect(within(r).getByText('9/14')).toBeInTheDocument()
    expect(within(r).getByText('Ended early')).toBeInTheDocument()
    expect(within(r).getByText('$1,234.50')).toBeInTheDocument()
    expect(within(r).getByText('La Chula')).toBeInTheDocument()
  })

  it('shows the room code in mono, a one-digit day without padding, and a negative profit with the minus sign', () => {
    mount([row({ finished_at: '2026-01-05T09:00:00Z', total_profit: -4.5, room_code: 'ZZZ999' })])
    const r = bodyRows()[0]
    expect(within(r).getByText('ZZZ999').className).toContain('font-mono')
    expect(within(r).getByText('5 Jan 2026')).toBeInTheDocument()
    expect(within(r).getByText(formatMoney(-4.5))).toBeInTheDocument()
  })

  it('shows the Ended early chip only on games that ended early', () => {
    mount([EXAMPLE, row({ game_id: 'g-full', ended_early: false, days_played: 14, duration_days: 14 })])
    expect(screen.getAllByText('Ended early')).toHaveLength(1)
    const full = bodyRows().find((r) => within(r).queryByText('14/14'))
    expect(full).toBeDefined()
    expect(within(full!).queryByText('Ended early')).toBeNull()
  })
})

describe('GamesTable order and Open links', () => {
  it('orders games newest first by finished_at whatever the input order', () => {
    mount([
      row({ game_id: 'old', display_name: 'Oldest', finished_at: '2026-08-01T10:00:00Z' }),
      row({ game_id: 'new', display_name: 'Newest', finished_at: '2026-10-12T10:00:00Z' }),
      row({ game_id: 'mid', display_name: 'Middle', finished_at: '2026-09-15T10:00:00Z' }),
    ])
    const names = bodyRows().map((r) => ['Newest', 'Middle', 'Oldest'].find((n) => within(r).queryByText(n)))
    expect(names).toEqual(['Newest', 'Middle', 'Oldest'])
  })

  it('gives each row an Open link to its own detail route', () => {
    mount([row({ game_id: 'aaa-1', display_name: 'First', finished_at: '2026-10-12T10:00:00Z' }), row({ game_id: 'bbb-2', display_name: 'Second', finished_at: '2026-09-01T10:00:00Z' })])
    const rows = bodyRows()
    expect(within(rows[0]).getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/profile/games/aaa-1')
    expect(within(rows[1]).getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/profile/games/bbb-2')
  })
})

describe('GamesTable with no games', () => {
  it('shows the empty state', () => {
    mount([])
    expect(screen.getByText('No games yet')).toBeInTheDocument()
    expect(screen.getByText('Finished games you play signed in appear here.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open' })).toBeNull()
  })
})
