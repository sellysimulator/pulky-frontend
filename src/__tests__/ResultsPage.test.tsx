/**
 * Section 29 - ResultsPage (spec 13.8 behaviour; design.md 4.4, 8.8).
 * Acceptance criteria 2, 4, 7, 8 (page side), 10 (header); failure modes 3, 4, 6, 8.
 * Requests are observed through the axios adapter (section 21, 3.3a); the REST clients are not mocked.
 */
import { createElement, type ReactNode } from 'react'
import { act, render, screen } from '@testing-library/react'
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
}))
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    loading: false,
    mode: auth.mode,
    user: { displayName: 'Ana Perez', email: 'ana@example.com', photoURL: null },
    signInWithGoogle: async () => undefined,
    continueAsGuest: () => undefined,
    signOut: async () => undefined,
  }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

import ResultsPage, { route } from '../pages/ResultsPage'
import { INITIAL_STATE, useGameStore } from '../store/gameStore'
import { formatMoney } from '../utils/format'
import { setHostSecret } from '../utils/storage'
import { NAMES, ROOM, makeFinished, makeResponse } from './fixtures/results'
import { hasClassAncestor, mockHttp, onScreen, ownersOf, urlPath, type HttpSpy } from './fixtures/resultsHelpers'

const NOT_FOUND = { detail: 'Results not found.' }
const UNAVAILABLE = "Results aren't available yet."
const OTHER_NAME = 'Otra Pulquería'
const TOP_PROFIT = formatMoney(5123.45)

let spy: HttpSpy | null = null

beforeEach(() => {
  useGameStore.setState({ ...INITIAL_STATE })
  auth.mode = 'authenticated'
})

afterEach(() => {
  vi.useRealTimers()
  spy?.restore()
  spy = null
  document.documentElement.removeAttribute('data-scale')
})

function mount(path: string) {
  const router = createMemoryRouter(
    [...route.map((r) => ({ path: r.path, element: <ResultsPage /> })), { path: '/host/:code', element: <p>host</p> }],
    { initialEntries: [path] },
  )
  return render(<RouterProvider router={router} />)
}

const finishedInStore = (room = ROOM, over: Record<string, unknown> = {}) =>
  useGameStore.setState({
    roomCode: room,
    finished: makeFinished() as never,
    durationDays: 14,
    ...over,
  })

/** A response whose pulquería names differ from the live payload's, to tell the two sources apart. */
const renamedResponse = () =>
  makeResponse((s) => {
    s.players.P2.display_name = OTHER_NAME
    s.leaderboard[0].display_name = OTHER_NAME
  })

function expectYouOnlyOn(name: string) {
  const chips = onScreen('You')
  expect(chips.length).toBeGreaterThan(0)
  for (const chip of chips) expect(ownersOf(chip, Object.values(NAMES))).toEqual([name])
}

const requestsFor = (p: string) => spy!.seen.filter((c) => urlPath(c) === p)

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}
const flush = () =>
  act(async () => {
    await Promise.resolve()
  })

describe('the route descriptor', () => {
  it('registers both results paths as public', () => {
    expect(route).toEqual([
      { path: '/results/:roomCode', guard: 'public' },
      { path: '/results/g/:gameId', guard: 'public' },
    ])
  })
})

describe('page chrome', () => {
  it('sets data-scale="debrief" on <html> while mounted and removes it on unmount', async () => {
    finishedInStore()
    const { unmount } = mount(`/results/${ROOM}`)
    expect(document.documentElement.dataset.scale).toBe('debrief')
    unmount()
    expect(document.documentElement.dataset.scale).toBeUndefined()
    expect(document.documentElement.hasAttribute('data-scale')).toBe(false)
  })

  it('shows the app header on top and hides it in print', () => {
    finishedInStore()
    mount(`/results/${ROOM}`)
    const account = screen.getByRole('button', { name: 'Account' })
    expect(hasClassAncestor(account, 'print:hidden')).toBe(true)
  })
})

describe('live path first (criterion 2, failure mode 8)', () => {
  it('uses the store\'s game_finished for the upper-cased room code and makes no request', async () => {
    spy = mockHttp(() => ({ status: 200, data: renamedResponse() }))
    finishedInStore()
    mount('/results/abc234')
    expect(screen.getAllByText(NAMES.P2).length).toBeGreaterThan(0)
    await flush()
    expect(spy.seen).toHaveLength(0)
  })

  it('failure mode 8: a game_finished for another room is not used; the results are fetched', async () => {
    spy = mockHttp(() => ({ status: 200, data: renamedResponse() }))
    finishedInStore('XYZ789')
    mount(`/results/${ROOM}`)
    await screen.findAllByText(OTHER_NAME)
    expect(requestsFor('games/ABC234/results')).toHaveLength(1)
    expect(screen.queryByText(NAMES.P2)).not.toBeInTheDocument()
  })

  it('fetches when the store holds no finished game', async () => {
    spy = mockHttp(() => ({ status: 200, data: renamedResponse() }))
    mount(`/results/${ROOM}`)
    await screen.findAllByText(OTHER_NAME)
    expect(requestsFor('games/ABC234/results')).toHaveLength(1)
  })

  it('/results/g/:gameId uses the store when gamePublicId matches, with no request', async () => {
    spy = mockHttp(() => ({ status: 200, data: renamedResponse() }))
    finishedInStore(ROOM, { gamePublicId: '9f2c1a' })
    mount('/results/g/9f2c1a')
    expect(screen.getAllByText(NAMES.P2).length).toBeGreaterThan(0)
    await flush()
    expect(spy.seen).toHaveLength(0)
  })

  it('/results/g/:gameId fetches by id when gamePublicId is another game', async () => {
    spy = mockHttp(() => ({ status: 200, data: renamedResponse() }))
    finishedInStore(ROOM, { gamePublicId: 'ffff00' })
    mount('/results/g/9f2c1a')
    await screen.findAllByText(OTHER_NAME)
    expect(requestsFor('games/id/9f2c1a/results')).toHaveLength(1)
    expect(requestsFor('games/ABC234/results')).toHaveLength(0)
  })

  it('/results/g/:gameId fetches by id when the store has no game id yet', async () => {
    spy = mockHttp(() => ({ status: 200, data: renamedResponse() }))
    finishedInStore()
    mount('/results/g/9f2c1a')
    await screen.findAllByText(OTHER_NAME)
    expect(requestsFor('games/id/9f2c1a/results')).toHaveLength(1)
  })
})

describe('loading', () => {
  it('shows Loading the results until the reply arrives', async () => {
    spy = mockHttp(() => ({ status: 200, data: renamedResponse() }))
    mount(`/results/${ROOM}`)
    expect(screen.getByText(/Loading the results/)).toBeInTheDocument()
    await screen.findAllByText(OTHER_NAME)
    expect(screen.queryByText(/Loading the results/)).not.toBeInTheDocument()
  })
})

describe('404 handling (criterion 7, failure mode 6)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('retries after 1000 ms and again after 2000 ms: exactly three requests, then the pinned message', async () => {
    spy = mockHttp(() => ({ status: 404, data: NOT_FOUND }))
    mount(`/results/${ROOM}`)
    await settle()
    expect(requestsFor('games/ABC234/results')).toHaveLength(1)
    expect(screen.queryByText(UNAVAILABLE)).not.toBeInTheDocument()

    await advance(999)
    expect(requestsFor('games/ABC234/results')).toHaveLength(1)
    await advance(1)
    expect(requestsFor('games/ABC234/results')).toHaveLength(2)
    expect(screen.queryByText(UNAVAILABLE)).not.toBeInTheDocument()

    await advance(1999)
    expect(requestsFor('games/ABC234/results')).toHaveLength(2)
    expect(screen.queryByText(UNAVAILABLE)).not.toBeInTheDocument()
    await advance(1)
    expect(requestsFor('games/ABC234/results')).toHaveLength(3)
    expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument()

    await advance(30000)
    expect(requestsFor('games/ABC234/results')).toHaveLength(3)
  })

  it('shows the message as a warning alert', async () => {
    spy = mockHttp(() => ({ status: 404, data: NOT_FOUND }))
    mount(`/results/${ROOM}`)
    await settle()
    await advance(3000)
    // InlineAlert: warning is a status, danger would be an alert (section 22).
    expect(screen.getByText(UNAVAILABLE).closest('[role="status"]')).not.toBeNull()
    expect(screen.getByText(UNAVAILABLE).closest('[role="alert"]')).toBeNull()
  })

  it('stops retrying and shows the results as soon as one request succeeds', async () => {
    spy = mockHttp((_cfg, nth) => (nth < 3 ? { status: 404, data: NOT_FOUND } : { status: 200, data: renamedResponse() }))
    mount(`/results/${ROOM}`)
    await settle()
    await advance(1000)
    expect(screen.queryAllByText(OTHER_NAME)).toHaveLength(0)
    await advance(2000)
    expect(screen.getAllByText(OTHER_NAME).length).toBeGreaterThan(0)
    expect(screen.queryByText(UNAVAILABLE)).not.toBeInTheDocument()
    await advance(30000)
    expect(requestsFor('games/ABC234/results')).toHaveLength(3)
  })

  it('retries by id on the /results/g/ route too', async () => {
    spy = mockHttp(() => ({ status: 404, data: NOT_FOUND }))
    mount('/results/g/9f2c1a')
    await settle()
    await advance(3000)
    expect(requestsFor('games/id/9f2c1a/results')).toHaveLength(3)
    expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument()
  })

  it('does not retry any other error: one request and a danger alert with the fallback', async () => {
    spy = mockHttp(() => ({ status: 500, data: {} }))
    mount(`/results/${ROOM}`)
    await settle()
    expect(screen.getByText('Could not load the results.').closest('[role="alert"]')).not.toBeNull()
    await advance(30000)
    expect(requestsFor('games/ABC234/results')).toHaveLength(1)
    expect(screen.queryByText(UNAVAILABLE)).not.toBeInTheDocument()
  })

  it('shows the server\'s own message for another error that has one', async () => {
    spy = mockHttp(() => ({ status: 503, data: { detail: 'Sign-in is not available right now.' } }))
    mount(`/results/${ROOM}`)
    await settle()
    expect(screen.getByText('Sign-in is not available right now.').closest('[role="alert"]')).not.toBeNull()
    expect(screen.queryByText('Could not load the results.')).not.toBeInTheDocument()
  })
})

describe('the viewer (criterion 4, failure modes 3 and 4)', () => {
  it('failure mode 3: with no host secret, profits show on the first render and there is no Reveal', () => {
    finishedInStore()
    mount(`/results/${ROOM}`)
    expect(onScreen(TOP_PROFIT).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Reveal' })).not.toBeInTheDocument()
  })

  it('failure mode 4: with the host secret for this room, no profit is on screen until Reveal is pressed', () => {
    setHostSecret(ROOM, 'sec-1')
    finishedInStore()
    mount(`/results/${ROOM}`)
    expect(onScreen(TOP_PROFIT)).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Reveal' })).toBeInTheDocument()
  })

  it('a host secret for another room does not hide the profits', () => {
    setHostSecret('XYZ789', 'sec-x')
    finishedInStore()
    mount(`/results/${ROOM}`)
    expect(onScreen(TOP_PROFIT).length).toBeGreaterThan(0)
  })

  it('the host sees the actions; a player does not', () => {
    setHostSecret(ROOM, 'sec-1')
    finishedInStore()
    const { unmount } = mount(`/results/${ROOM}`)
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument()
    unmount()
    window.sessionStorage.clear()
    mount(`/results/${ROOM}`)
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument()
  })

  it('marks the store\'s own alias with You when the store is in this room', () => {
    finishedInStore(ROOM, { myAlias: 'P1' })
    mount(`/results/${ROOM}`)
    expectYouOnlyOn(NAMES.P1)
  })

  it('shows no You for a fetched summary when the store is in another room', async () => {
    spy = mockHttp(() => ({ status: 200, data: makeResponse() }))
    useGameStore.setState({ roomCode: 'XYZ789', myAlias: 'P1' })
    mount(`/results/${ROOM}`)
    await screen.findAllByText(NAMES.P2)
    expect(onScreen('You')).toHaveLength(0)
  })

  it('shows You for a fetched summary when the store is in this room', async () => {
    spy = mockHttp(() => ({ status: 200, data: makeResponse() }))
    useGameStore.setState({ roomCode: ROOM, myAlias: 'P1' })
    mount(`/results/${ROOM}`)
    await screen.findAllByText(NAMES.P2)
    expectYouOnlyOn(NAMES.P1)
  })

  it('offers the claim prompt to a guest with a guest id and a session token for this room', async () => {
    const { getOrCreateGuestId, setSessionToken } = await import('../utils/storage')
    getOrCreateGuestId()
    setSessionToken(ROOM, 'tok')
    auth.mode = 'guest'
    finishedInStore()
    mount(`/results/${ROOM}`)
    expect(screen.getByText('Sign in to keep these results in your profile.')).toBeInTheDocument()
  })

  it('does not offer it to a signed-in user', async () => {
    const { getOrCreateGuestId, setSessionToken } = await import('../utils/storage')
    getOrCreateGuestId()
    setSessionToken(ROOM, 'tok')
    auth.mode = 'authenticated'
    finishedInStore()
    mount(`/results/${ROOM}`)
    expect(screen.queryByText('Sign in to keep these results in your profile.')).not.toBeInTheDocument()
  })
})

describe('the same figures on both paths (criterion 2)', () => {
  it('shows the same pulquería names and the same profits live and fetched', async () => {
    window.sessionStorage.clear()
    finishedInStore()
    const live = mount(`/results/${ROOM}`)
    const liveNames = Object.values(NAMES).map((n) => screen.getAllByText(n).length)
    const liveProfit = onScreen(TOP_PROFIT).length
    live.unmount()

    useGameStore.setState({ ...INITIAL_STATE })
    spy = mockHttp(() => ({ status: 200, data: makeResponse() }))
    mount(`/results/${ROOM}`)
    await screen.findAllByText(NAMES.P2)
    expect(Object.values(NAMES).map((n) => screen.getAllByText(n).length)).toEqual(liveNames)
    expect(onScreen(TOP_PROFIT).length).toBe(liveProfit)
  })
})
