/**
 * Section 30 - GameDetail (plan 3.3; spec 13.8: the profile renders the same components from the same response).
 * Acceptance criteria 4, 5; failure modes 2 (same summary), 3 (no actions).
 * Requests are observed through the axios adapter; the REST clients are not mocked.
 */
import { createElement, type ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
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
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    loading: false,
    mode: 'authenticated',
    user: { displayName: 'Zed Tester', email: 'zed@example.com', photoURL: null },
    signInWithGoogle: async () => undefined,
    continueAsGuest: () => undefined,
    signOut: async () => undefined,
  }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

import GameDetail from '../components/profile/GameDetail'
import ResultsSummary from '../components/results/ResultsSummary'
import { INITIAL_STATE, useGameStore } from '../store/gameStore'
import { formatMoney } from '../utils/format'
import { NAMES, makeResponse, makeView } from './fixtures/results'
import { allCharts, mockHttp, onScreen, ownersOf, urlPath, type HttpSpy } from './fixtures/resultsHelpers'

let spy: HttpSpy | null = null

beforeEach(() => {
  useGameStore.setState({ ...INITIAL_STATE })
})
afterEach(() => {
  spy?.restore()
  spy = null
  document.documentElement.removeAttribute('data-scale')
})

const GAME_ID = '9f2c1a'
const myGame = (alias = 'P1') => ({ ...makeResponse(), my_alias: alias })

function mount(gameId = GAME_ID) {
  const router = createMemoryRouter(
    [
      { path: '/profile', element: <p>profile list</p> },
      { path: '*', element: <GameDetail gameId={gameId} /> },
    ],
    { initialEntries: [`/profile/games/${gameId}`] },
  )
  return render(<RouterProvider router={router} />)
}

function serve(reply: { status: number; data?: unknown }) {
  spy = mockHttp(() => reply)
}

describe('GameDetail', () => {
  it('requests the user route for this game and renders the summary blocks 1 to 5', async () => {
    serve({ status: 200, data: myGame() })
    mount()
    await screen.findByText('1. Leaderboard')
    expect(spy!.seen.map(urlPath)).toEqual([`users/me/games/${GAME_ID}`])
    for (const title of [/Leaderboard/, /Where the pulque went/, /Ratios/, /Decisions/]) {
      expect(screen.queryAllByText(title).length).toBeGreaterThan(0)
    }
    expect(allCharts().length).toBeGreaterThan(0)
    for (const name of Object.values(NAMES)) expect(screen.getAllByText(name).length).toBeGreaterThan(0)
  })

  it('highlights my_alias as You on that pulquería only, and not on the others', async () => {
    serve({ status: 200, data: myGame('P2') })
    mount()
    await screen.findByText('1. Leaderboard')
    const chips = onScreen('You')
    expect(chips.length).toBeGreaterThan(0)
    for (const chip of chips) expect(ownersOf(chip, Object.values(NAMES))).toEqual([NAMES.P2])
  })

  it('shows the profits revealed (a viewer who is not the host)', async () => {
    serve({ status: 200, data: myGame() })
    mount()
    await screen.findByText(formatMoney(5123.45))
    expect(screen.queryByRole('button', { name: 'Reveal' })).toBeNull()
  })

  it('links back to the profile', async () => {
    serve({ status: 200, data: myGame() })
    mount()
    await screen.findByText('1. Leaderboard')
    expect(screen.getByRole('link', { name: /Back to profile/ })).toHaveAttribute('href', '/profile')
  })

  it('renders at the default scale: never sets data-scale', async () => {
    serve({ status: 200, data: myGame() })
    mount()
    await screen.findByText('1. Leaderboard')
    expect(document.documentElement.hasAttribute('data-scale')).toBe(false)
  })

  it('shows a loading spinner while the request is pending', () => {
    spy = mockHttp(() => ({ status: 200, data: myGame() }))
    mount()
    expect(screen.getByText('Loading your profile')).toBeInTheDocument()
  })
})

describe('failure mode 3: actions on a profile', () => {
  it('renders no Export CSV, Play again or Debrief notes, nor the actions block', async () => {
    serve({ status: 200, data: myGame() })
    mount()
    await screen.findByText('1. Leaderboard')
    expect(screen.queryByText(/Export CSV/i)).toBeNull()
    expect(screen.queryByText(/Export/i)).toBeNull()
    expect(screen.queryByText(/Play again/i)).toBeNull()
    expect(screen.queryByText(/Debrief notes/i)).toBeNull()
    expect(screen.queryByText(/Claim your results/i)).toBeNull()
    expect(screen.queryByText(/6\. Actions/)).toBeNull()
  })

  it('renders no actions even when this browser holds a host secret for the room', async () => {
    sessionStorage.setItem('pulky.host_secret.ABC234', 'secret')
    serve({ status: 200, data: myGame() })
    mount()
    await screen.findByText('1. Leaderboard')
    expect(screen.queryByText(/Export/i)).toBeNull()
    expect(screen.queryByText(/Play again/i)).toBeNull()
    expect(screen.queryByText(/Debrief notes/i)).toBeNull()
  })
})

describe('failure mode 2: a different summary for the same game', () => {
  it('renders the same leaderboard and charts as ResultsSummary does for the view of that response', async () => {
    serve({ status: 200, data: myGame('P1') })
    const detail = mount()
    await screen.findByText('1. Leaderboard')
    const detailOl = detail.container.querySelector('ol')!.textContent
    const detailCharts = allCharts().map((c) => JSON.stringify([c.type, c.data, c.options]))
    detail.unmount()

    const reference = render(
      <ResultsSummary view={makeView()} viewer={{ isHost: false, myAlias: 'P1' }} showActions={false} hostSecret={null} />,
    )
    expect(detailOl).toBe(reference.container.querySelector('ol')!.textContent)
    expect(detailOl).toContain(NAMES.P2)
    // rank order: La Chula (P2), El Tinacal (P3), Don Agave (P1)
    expect(detailOl!.indexOf(NAMES.P2)).toBeLessThan(detailOl!.indexOf(NAMES.P3))
    expect(detailOl!.indexOf(NAMES.P3)).toBeLessThan(detailOl!.indexOf(NAMES.P1))
    expect(detailCharts).toEqual(allCharts().map((c) => JSON.stringify([c.type, c.data, c.options])))
  })
})

describe('errors', () => {
  it('shows the warning alert on a 404', async () => {
    serve({ status: 404, data: { detail: 'Results not found.' } })
    mount()
    const alert = await screen.findByText('That game is not in your profile.')
    expect(alert).toBeInTheDocument()
    expect(screen.queryByText('1. Leaderboard')).toBeNull()
  })

  it('shows a danger alert with the server detail on another failure', async () => {
    serve({ status: 500, data: { detail: 'Database is down.' } })
    mount()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Database is down.')
    expect(screen.queryByText('That game is not in your profile.')).toBeNull()
  })

  it('falls back to the profile message when the failure carries no detail', async () => {
    serve({ status: 500 })
    mount()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not load your profile.'))
  })
})
