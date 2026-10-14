/**
 * Section 30 - ProfilePage, ProfileHeader, ProfileStats (plan 3.1, 3.2; design.md 8.9; spec 13.6 avatars).
 * Acceptance criteria 1, 2, 3, 5 (route side), 6; failure modes 1, 4, 5.
 * Requests are observed through the axios adapter; the REST clients are not mocked.
 */
import { createElement, type ReactNode } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-chartjs-2', () => {
  const make = (type: string) => (props: { data?: unknown; options?: unknown }) =>
    createElement('div', {
      'data-testid': `chart-${type}`,
      'data-chart': JSON.stringify({ type, data: props.data, options: props.options }),
    })
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
    user: { displayName: 'Zed Tester', email: 'zed@example.com', photoURL: null },
    signInWithGoogle: auth.signIn,
    continueAsGuest: () => undefined,
    signOut: async () => undefined,
  }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

import ProfilePage, { route } from '../pages/ProfilePage'
import { INITIAL_STATE, useGameStore } from '../store/gameStore'
import type { MyGameRow, UserMe, UserStats } from '../types/game'
import { formatMoney } from '../utils/format'
import { makeResponse } from './fixtures/results'
import { mockHttp, urlPath, type HttpSpy } from './fixtures/resultsHelpers'

const ME: UserMe = { display_name: 'Ana Perez', email: 'ana@example.com', photo_url: 'https://lh3.googleusercontent.com/a/ana' }
const STATS: UserStats = {
  games_played: 12,
  wins: 5,
  total_profit: 4321.5,
  best_profit: 1500,
  avg_fill_rate: 0.912,
  avg_waste_rate: null,
  avg_market_share: 0.334,
}
const GAMES: MyGameRow[] = [
  {
    game_id: 'older', room_code: 'OLD111', finished_at: '2026-09-01T10:00:00Z', days_played: 14, duration_days: 14,
    player_count: 3, ended_early: false, alias: 'P1', display_name: 'Don Agave', rank: 3, total_profit: -250.75,
  },
  {
    game_id: 'newer', room_code: 'NEW222', finished_at: '2026-10-12T18:30:00Z', days_played: 9, duration_days: 14,
    player_count: 4, ended_early: true, alias: 'P2', display_name: 'La Chula', rank: 2, total_profit: 1234.5,
  },
]

let spy: HttpSpy | null = null
interface Data { me?: UserMe; stats?: UserStats; games?: MyGameRow[]; fail?: { path: string; status: number; data?: unknown }; game?: { status: number; data?: unknown } }

function serve(d: Data = {}) {
  spy = mockHttp((cfg) => {
    const p = urlPath(cfg)
    if (d.fail && p === d.fail.path) return { status: d.fail.status, data: d.fail.data }
    if (p === 'users/me') return { status: 200, data: d.me ?? ME }
    if (p === 'users/me/stats') return { status: 200, data: d.stats ?? STATS }
    if (p === 'users/me/games') return { status: 200, data: { games: d.games ?? GAMES } }
    if (p.startsWith('users/me/games/')) return d.game ?? { status: 200, data: { ...makeResponse(), my_alias: 'P1' } }
    return { status: 404, data: { detail: 'unexpected ' + p } }
  })
}

beforeEach(() => {
  useGameStore.setState({ ...INITIAL_STATE })
  auth.mode = 'authenticated'
  auth.signIn.mockClear()
})
afterEach(() => {
  spy?.restore()
  spy = null
})

function mount(path = '/profile') {
  const router = createMemoryRouter(route.map((r) => ({ path: r.path, element: <ProfilePage /> })), { initialEntries: [path] })
  return { router, ...render(<RouterProvider router={router} />) }
}

const tile = (label: string) => screen.getByText(label).parentElement!.parentElement as HTMLElement

describe('the route descriptor', () => {
  it('registers both profile paths behind auth and backend', () => {
    expect(route).toEqual([
      { path: '/profile', guard: 'auth+backend' },
      { path: '/profile/games/:gameId', guard: 'auth+backend' },
    ])
  })
})

describe('failure mode 1 / criterion 1: a guest', () => {
  it('sees the sign-in empty state on /profile and no user request is made', async () => {
    auth.mode = 'guest'
    serve()
    mount('/profile')
    expect(screen.getByText('Sign in to see your profile')).toBeInTheDocument()
    expect(screen.getByText('Games you play signed in are saved here.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }))
    expect(auth.signIn).toHaveBeenCalledTimes(1)
    await new Promise((r) => setTimeout(r, 20))
    expect(spy!.seen).toHaveLength(0)
    expect(screen.queryByText('Loading your profile')).toBeNull()
    expect(screen.queryByText('Your games')).toBeNull()
  })

  it('makes no request on the detail route either', async () => {
    auth.mode = 'guest'
    serve()
    mount('/profile/games/9f2c1a')
    expect(screen.getByText('Sign in to see your profile')).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 20))
    expect(spy!.seen).toHaveLength(0)
  })
})

describe('/profile', () => {
  it('shows a spinner, then calls the three user routes', async () => {
    serve()
    mount()
    expect(screen.getByText('Loading your profile')).toBeInTheDocument()
    await screen.findByText('Ana Perez')
    expect(spy!.seen.map(urlPath).sort()).toEqual(['users/me', 'users/me/games', 'users/me/stats'])
    expect(screen.queryByText('Loading your profile')).toBeNull()
  })

  it('renders the header, the seven stat tiles and the games table in that order', async () => {
    serve()
    mount()
    const name = await screen.findByText('Ana Perez')
    expect(screen.getByText('ana@example.com')).toBeInTheDocument()
    const labels = ['Games played', 'Wins', 'Total profit', 'Best profit', 'Avg fill rate', 'Avg waste rate', 'Avg market share']
    const table = await screen.findByRole('table', { name: 'Your games' })
    const before = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    let previous: Node = name
    for (const l of labels) {
      const el = screen.getByText(l)
      expect(before(previous, el)).toBe(true)
      previous = el
    }
    expect(before(previous, table)).toBe(true)
  })

  it('formats the stat tiles: counts, money, percentages', async () => {
    serve()
    mount()
    await screen.findByText('Ana Perez')
    expect(tile('Games played')).toHaveTextContent('12')
    expect(tile('Wins')).toHaveTextContent('5')
    expect(tile('Total profit')).toHaveTextContent(formatMoney(4321.5))
    expect(tile('Best profit')).toHaveTextContent(formatMoney(1500))
    expect(tile('Avg fill rate')).toHaveTextContent('91%')
    expect(tile('Avg market share')).toHaveTextContent('33%')
  })

  it('lists the games newest first with the formats of the spec and Open links to the detail route', async () => {
    serve()
    mount()
    const table = await screen.findByRole('table', { name: 'Your games' })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('12 Oct 2026')).toBeInTheDocument()
    expect(within(rows[0]).getByText('2 of 4')).toBeInTheDocument()
    expect(within(rows[0]).getByText('9/14')).toBeInTheDocument()
    expect(within(rows[0]).getByText('Ended early')).toBeInTheDocument()
    expect(within(rows[0]).getByText(formatMoney(1234.5))).toBeInTheDocument()
    expect(within(rows[0]).getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/profile/games/newer')
    expect(within(rows[1]).getByText('1 Sep 2026')).toBeInTheDocument()
    expect(within(rows[1]).getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/profile/games/older')
  })

  it('follows an Open link to the game detail', async () => {
    serve()
    mount()
    const table = await screen.findByRole('table', { name: 'Your games' })
    await userEvent.click(within(table).getAllByRole('link', { name: 'Open' })[0])
    await screen.findByText(/Leaderboard/)
    expect(spy!.seen.map(urlPath)).toContain('users/me/games/newer')
    expect(screen.getByRole('link', { name: /Back to profile/ })).toBeInTheDocument()
  })

  it('shows the empty state when there are no games', async () => {
    serve({ games: [] })
    mount()
    await screen.findByText('No games yet')
    expect(screen.getByText('Finished games you play signed in appear here.')).toBeInTheDocument()
  })

  it('shows a danger alert with the fallback when a request fails without detail', async () => {
    serve({ fail: { path: 'users/me/stats', status: 500 } })
    mount()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not load your profile.')
    expect(screen.queryByText('Loading your profile')).toBeNull()
  })

  it('shows the server detail when the failure carries one', async () => {
    serve({ fail: { path: 'users/me/games', status: 500, data: { detail: 'Database is down.' } } })
    mount()
    expect(await screen.findByRole('alert')).toHaveTextContent('Database is down.')
  })
})

describe('/profile/games/:gameId', () => {
  it('renders the game detail, not the list', async () => {
    serve()
    mount('/profile/games/9f2c1a')
    await screen.findByText(/Leaderboard/)
    expect(spy!.seen.map(urlPath)).toEqual(['users/me/games/9f2c1a'])
    expect(screen.queryByText('Your games')).toBeNull()
  })

  it('criterion 5: a 404 shows the warning', async () => {
    serve({ game: { status: 404, data: { detail: 'Results not found.' } } })
    mount('/profile/games/nope')
    expect(await screen.findByText('That game is not in your profile.')).toBeInTheDocument()
  })
})

describe('avatar (criterion 6, failure mode 4)', () => {
  it('uses the photo with referrerPolicy no-referrer', async () => {
    serve()
    const { container } = mount()
    await screen.findByText('Ana Perez')
    const img = container.querySelector('img')!
    expect(img).toHaveAttribute('src', ME.photo_url)
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer')
  })

  it('falls back to the initial when the image fails to load', async () => {
    serve()
    const { container } = mount()
    await screen.findByText('Ana Perez')
    expect(screen.queryByText('A')).toBeNull()
    fireEvent.error(container.querySelector('img')!)
    await waitFor(() => expect(container.querySelector('img')).toBeNull())
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('Ana Perez')).toBeInTheDocument()
  })

  it('shows the initial straight away when there is no photo_url', async () => {
    serve({ me: { ...ME, photo_url: null } })
    const { container } = mount()
    await screen.findByText('Ana Perez')
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('A')).toBeInTheDocument()
  })
})

describe('failure mode 5: null averages are not zero', () => {
  it('shows an em dash for a null average and never 0%', async () => {
    serve({ stats: { ...STATS, avg_waste_rate: null, avg_fill_rate: null, avg_market_share: null } })
    mount()
    await screen.findByText('Ana Perez')
    for (const l of ['Avg fill rate', 'Avg waste rate', 'Avg market share']) {
      expect(tile(l)).toHaveTextContent('—')
      expect(tile(l)).not.toHaveTextContent('0%')
    }
    expect(screen.queryByText('0%')).toBeNull()
  })

  it('still shows a real zero as 0%', async () => {
    serve({ stats: { ...STATS, avg_waste_rate: 0 } })
    mount()
    await screen.findByText('Ana Perez')
    expect(tile('Avg waste rate')).toHaveTextContent('0%')
  })
})
