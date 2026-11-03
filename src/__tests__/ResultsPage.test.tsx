/**
 * Section 29 - ResultsPage (spec 13.8 behaviour; design.md 4.4, 8.8).
 * Acceptance criteria 2, 4, 7, 8 (page side), 10 (header); failure modes 3, 4, 6, 8.
 * Requests are observed through the axios adapter (section 21, 3.3a); the REST clients are not mocked.
 */
import { createElement, type ReactNode } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
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

// `user` is one object per sign-in, as the real context's memoised value is: a new object on every
// render would read as a new account each time.
const auth = vi.hoisted(() => ({
  mode: 'authenticated' as 'authenticated' | 'guest' | null,
  user: { displayName: 'Ana Perez', email: 'ana@example.com', photoURL: null } as {
    displayName: string
    email: string
    photoURL: null
  },
}))
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    loading: false,
    mode: auth.mode,
    user: auth.user,
    signInWithGoogle: async () => undefined,
    continueAsGuest: () => undefined,
    signOut: async () => undefined,
  }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

import ResultsPage, { route } from '../pages/ResultsPage'
import { INITIAL_STATE, useGameStore } from '../store/gameStore'
import { formatMoney } from '../utils/format'
import { setGameHostSecret, setHostSecret } from '../utils/storage'
import { GAME_ID, NAMES, ROOM, makeFinished, makeResponse } from './fixtures/results'
import {
  hasClassAncestor,
  header,
  mockHttp,
  onScreen,
  ownersOf,
  urlPath,
  verb,
  type HttpSpy,
  type Reply,
} from './fixtures/resultsHelpers'

const NOT_FOUND = { detail: 'Results not found.' }
const UNAVAILABLE = "Results aren't available yet."
const OTHER_NAME = 'Otra Pulquería'
const TOP_PROFIT = formatMoney(5123.45)
const PAGE = `/results/${GAME_ID}`
const BY_ID = `games/id/${GAME_ID}/results`
const OTHER_GAME = 'ffff00'
const HOSTED_PREFIX = 'users/me/hosted-games/'
const HOSTED = `${HOSTED_PREFIX}${GAME_ID}`

let spy: HttpSpy | null = null
/** Nothing leaves the test: a request no test answers gets a 404 (for the hosted check, "not yours"). */
let offline: HttpSpy | null = null

beforeEach(() => {
  useGameStore.setState({ ...INITIAL_STATE })
  auth.mode = 'authenticated'
  auth.user = { displayName: 'Ana Perez', email: 'ana@example.com', photoURL: null }
  offline = mockHttp(() => ({ status: 404, data: NOT_FOUND }))
})

afterEach(() => {
  vi.useRealTimers()
  spy?.restore()
  spy = null
  offline?.restore()
  offline = null
  document.documentElement.removeAttribute('data-scale')
})

function mount(path: string) {
  const router = createMemoryRouter(
    [...route.map((r) => ({ path: r.path, element: <ResultsPage /> })), { path: '/host/:code', element: <p>host</p> }],
    { initialEntries: [path] },
  )
  return { router, ...render(<RouterProvider router={router} />) }
}

/** This tab saw the game finish: `game_finished` carried its id. */
const finishedInStore = (over: Record<string, unknown> = {}) =>
  useGameStore.setState({
    roomCode: ROOM,
    finished: makeFinished() as never,
    gamePublicId: GAME_ID,
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
  it('registers the results path, by game id only, as public', () => {
    expect(route).toEqual([{ path: '/results/:gameId', guard: 'public' }])
  })
})

describe('page chrome', () => {
  it('sets data-scale="debrief" on <html> while mounted and removes it on unmount', async () => {
    finishedInStore()
    const { unmount } = mount(PAGE)
    expect(document.documentElement.dataset.scale).toBe('debrief')
    unmount()
    expect(document.documentElement.dataset.scale).toBeUndefined()
    expect(document.documentElement.hasAttribute('data-scale')).toBe(false)
  })

  it('shows the app header on top and hides it in print', () => {
    finishedInStore()
    mount(PAGE)
    const account = screen.getByRole('button', { name: 'Account' })
    expect(hasClassAncestor(account, 'print:hidden')).toBe(true)
  })
})

describe('live path first (criterion 2, failure mode 8)', () => {
  it('uses the store\'s game_finished when it carries this page\'s game id, and requests no results', async () => {
    spy = mockHttp(() => ({ status: 200, data: renamedResponse() }))
    finishedInStore()
    mount(PAGE)
    expect(screen.getAllByText(NAMES.P2).length).toBeGreaterThan(0)
    await flush()
    // A signed-in viewer without the host secret only asks whether they hosted it.
    expect(spy.seen.map(urlPath)).toEqual([HOSTED])
  })

  it('failure mode 8: a game_finished for another game is not used, even under the same room code', async () => {
    spy = mockHttp(() => ({ status: 200, data: renamedResponse() }))
    finishedInStore({ finished: { ...makeFinished(), game_id: OTHER_GAME } as never, gamePublicId: OTHER_GAME })
    mount(PAGE)
    await screen.findAllByText(OTHER_NAME)
    expect(requestsFor(BY_ID)).toHaveLength(1)
    expect(screen.queryByText(NAMES.P2)).not.toBeInTheDocument()
  })

  it('fetches by id when the store holds no finished game', async () => {
    spy = mockHttp(() => ({ status: 200, data: renamedResponse() }))
    mount(PAGE)
    await screen.findAllByText(OTHER_NAME)
    expect(requestsFor(BY_ID)).toHaveLength(1)
    expect(spy.seen.every((c) => urlPath(c) === BY_ID || urlPath(c) === HOSTED)).toBe(true)
  })
})

describe('loading', () => {
  it('shows Loading the results until the reply arrives', async () => {
    spy = mockHttp(() => ({ status: 200, data: renamedResponse() }))
    mount(PAGE)
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
    mount(PAGE)
    await settle()
    expect(requestsFor(BY_ID)).toHaveLength(1)
    expect(screen.queryByText(UNAVAILABLE)).not.toBeInTheDocument()

    await advance(999)
    expect(requestsFor(BY_ID)).toHaveLength(1)
    await advance(1)
    expect(requestsFor(BY_ID)).toHaveLength(2)
    expect(screen.queryByText(UNAVAILABLE)).not.toBeInTheDocument()

    await advance(1999)
    expect(requestsFor(BY_ID)).toHaveLength(2)
    expect(screen.queryByText(UNAVAILABLE)).not.toBeInTheDocument()
    await advance(1)
    expect(requestsFor(BY_ID)).toHaveLength(3)
    expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument()

    await advance(30000)
    expect(requestsFor(BY_ID)).toHaveLength(3)
  })

  it('shows the message as a warning alert', async () => {
    spy = mockHttp(() => ({ status: 404, data: NOT_FOUND }))
    mount(PAGE)
    await settle()
    await advance(3000)
    // InlineAlert: warning is a status, danger would be an alert (section 22).
    expect(screen.getByText(UNAVAILABLE).closest('[role="status"]')).not.toBeNull()
    expect(screen.getByText(UNAVAILABLE).closest('[role="alert"]')).toBeNull()
  })

  it('stops retrying and shows the results as soon as one request succeeds', async () => {
    spy = mockHttp((_cfg, nth) => (nth < 3 ? { status: 404, data: NOT_FOUND } : { status: 200, data: renamedResponse() }))
    mount(PAGE)
    await settle()
    await advance(1000)
    expect(screen.queryAllByText(OTHER_NAME)).toHaveLength(0)
    await advance(2000)
    expect(screen.getAllByText(OTHER_NAME).length).toBeGreaterThan(0)
    expect(screen.queryByText(UNAVAILABLE)).not.toBeInTheDocument()
    await advance(30000)
    expect(requestsFor(BY_ID)).toHaveLength(3)
  })

  it('does not retry any other error: one request and a danger alert with the fallback', async () => {
    spy = mockHttp(() => ({ status: 500, data: {} }))
    mount(PAGE)
    await settle()
    expect(screen.getByText('Could not load the results.').closest('[role="alert"]')).not.toBeNull()
    await advance(30000)
    expect(requestsFor(BY_ID)).toHaveLength(1)
    expect(screen.queryByText(UNAVAILABLE)).not.toBeInTheDocument()
  })

  it('shows the server\'s own message for another error that has one', async () => {
    spy = mockHttp(() => ({ status: 503, data: { detail: 'Sign-in is not available right now.' } }))
    mount(PAGE)
    await settle()
    expect(screen.getByText('Sign-in is not available right now.').closest('[role="alert"]')).not.toBeNull()
    expect(screen.queryByText('Could not load the results.')).not.toBeInTheDocument()
  })
})

describe('the viewer (criterion 4, failure modes 3 and 4)', () => {
  it('failure mode 3: with no host secret, profits show on the first render and there is no Reveal', () => {
    finishedInStore()
    mount(PAGE)
    expect(onScreen(TOP_PROFIT).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Reveal' })).not.toBeInTheDocument()
  })

  it('failure mode 4: with the host secret for this game, no profit is on screen until Reveal is pressed', () => {
    setGameHostSecret(GAME_ID, 'sec-1')
    finishedInStore()
    mount(PAGE)
    expect(onScreen(TOP_PROFIT)).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Reveal' })).toBeInTheDocument()
  })

  it('a host secret for another game does not hide the profits', () => {
    setGameHostSecret(OTHER_GAME, 'sec-x')
    finishedInStore()
    mount(PAGE)
    expect(onScreen(TOP_PROFIT).length).toBeGreaterThan(0)
  })

  it('a host secret stored only under the room code does not make the viewer this game\'s host', () => {
    setHostSecret(ROOM, 'sec-of-a-later-room')
    finishedInStore()
    mount(PAGE)
    expect(onScreen(TOP_PROFIT).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument()
  })

  it('the host sees the actions; a player does not', () => {
    setGameHostSecret(GAME_ID, 'sec-1')
    finishedInStore()
    const { unmount } = mount(PAGE)
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument()
    unmount()
    window.sessionStorage.clear()
    mount(PAGE)
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument()
  })

  it('marks the store\'s own alias with You when the store holds this game', () => {
    finishedInStore({ myAlias: 'P1' })
    mount(PAGE)
    expectYouOnlyOn(NAMES.P1)
  })

  it('shows no You for a fetched summary when the store holds another game under the same room code', async () => {
    spy = mockHttp(() => ({ status: 200, data: makeResponse() }))
    useGameStore.setState({ roomCode: ROOM, gamePublicId: OTHER_GAME, myAlias: 'P1' })
    mount(PAGE)
    await screen.findAllByText(NAMES.P2)
    expect(onScreen('You')).toHaveLength(0)
  })

  it('shows You for a fetched summary when the store holds this game', async () => {
    spy = mockHttp(() => ({ status: 200, data: makeResponse() }))
    useGameStore.setState({ roomCode: ROOM, gamePublicId: GAME_ID, myAlias: 'P1' })
    mount(PAGE)
    await screen.findAllByText(NAMES.P2)
    expectYouOnlyOn(NAMES.P1)
  })

  it('offers the claim prompt to a guest with a guest id who played this game', async () => {
    const { getOrCreateGuestId, markGamePlayed } = await import('../utils/storage')
    getOrCreateGuestId()
    markGamePlayed(GAME_ID)
    auth.mode = 'guest'
    finishedInStore()
    mount(PAGE)
    expect(screen.getByText('Sign in to keep these results in your profile.')).toBeInTheDocument()
  })

  it('does not offer it to a guest who only holds a session token under this room code', async () => {
    const { getOrCreateGuestId, setSessionToken } = await import('../utils/storage')
    getOrCreateGuestId()
    setSessionToken(ROOM, 'tok')
    auth.mode = 'guest'
    finishedInStore()
    mount(PAGE)
    expect(screen.queryByText('Sign in to keep these results in your profile.')).not.toBeInTheDocument()
  })

  it('does not offer it to a signed-in user', async () => {
    const { getOrCreateGuestId, markGamePlayed } = await import('../utils/storage')
    getOrCreateGuestId()
    markGamePlayed(GAME_ID)
    auth.mode = 'authenticated'
    finishedInStore()
    mount(PAGE)
    expect(screen.queryByText('Sign in to keep these results in your profile.')).not.toBeInTheDocument()
  })
})

describe('the export for a signed-in host without the secret (spec 13.8 block 6)', () => {
  /** A host config with its seed for this game: what Play again needs on the live host path. */
  const HOST_CONFIG = { random_seed: 424242 }
  const asked = () => spy!.seen.filter((c) => urlPath(c).startsWith(HOSTED_PREFIX))
  /** Every pending reply and state update has landed (no fake timers in this block). */
  const settleAll = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

  /** Results and the export answer for the id asked; the hosted check answers `hosted(id)`. */
  function serve(hosted: (gameId: string) => Reply | Promise<Reply>): HttpSpy {
    return mockHttp((cfg) => {
      const path = urlPath(cfg)
      if (path.startsWith(HOSTED_PREFIX)) return hosted(path.slice(HOSTED_PREFIX.length))
      if (path.endsWith('/export')) return { status: 200, data: new Blob(['{}']) }
      return { status: 200, data: { ...makeResponse(), game_id: path.split('/')[2] } }
    })
  }

  it('asks once and offers Export after a 204; the download carries no host secret', async () => {
    spy = serve(() => ({ status: 204 }))
    finishedInStore()
    mount(PAGE)
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Export CSV' })).toBeInTheDocument()
    expect(asked().map(urlPath)).toEqual([HOSTED])
    expect(verb(asked()[0])).toBe('GET')

    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    try {
      await userEvent.click(screen.getByRole('button', { name: 'Export JSON' }))
      await waitFor(() => expect(click).toHaveBeenCalledTimes(1))
      const download = spy.seen.find((c) => urlPath(c) === `games/id/${GAME_ID}/export`)
      expect(download).toBeDefined()
      expect(header(download!, 'X-Host-Secret')).toBeUndefined()
    } finally {
      click.mockRestore()
    }
  })

  it('offers only the export: Play again, the debrief notes and the hidden leaderboard stay keyed to the secret', async () => {
    spy = serve(() => ({ status: 204 }))
    finishedInStore({ config: HOST_CONFIG })
    mount(PAGE)
    await screen.findByRole('button', { name: 'Export CSV' })
    expect(screen.queryByRole('button', { name: 'Play again' })).not.toBeInTheDocument()
    expect(screen.queryByText('Debrief notes')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reveal' })).not.toBeInTheDocument()
    expect(onScreen(TOP_PROFIT).length).toBeGreaterThan(0)
  })

  it('with this game\'s host secret offers every host action on the first render and asks nothing', async () => {
    spy = serve(() => ({ status: 404, data: NOT_FOUND }))
    setGameHostSecret(GAME_ID, 'sec-1')
    finishedInStore({ config: HOST_CONFIG })
    mount(PAGE)
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument()
    expect(screen.getByText('Debrief notes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reveal' })).toBeInTheDocument()
    await settleAll()
    expect(asked()).toHaveLength(0)
  })

  it.each<[string, Reply]>([
    ['a 404', { status: 404, data: NOT_FOUND }],
    ['a 401', { status: 401, data: { detail: 'Sign in to continue.' } }],
    ['a server error', { status: 500, data: {} }],
  ])('offers no export and raises no alert after %s', async (_why, reply) => {
    spy = serve(() => reply)
    finishedInStore()
    mount(PAGE)
    await waitFor(() => expect(asked()).toHaveLength(1))
    await settleAll()
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument()
    expect(screen.queryAllByRole('alert')).toHaveLength(0)
    expect(useGameStore.getState().alerts).toHaveLength(0)
  })

  it.each([['guest' as const], [null]])('never asks when the viewer is not signed in (mode %s)', async (mode) => {
    spy = serve(() => ({ status: 204 }))
    auth.mode = mode
    mount(PAGE)
    await screen.findAllByText(NAMES.P2)
    await settleAll()
    expect(asked()).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument()
  })

  it('asks once per game id, however often the page renders', async () => {
    spy = serve(() => ({ status: 204 }))
    finishedInStore()
    mount(PAGE)
    await screen.findByRole('button', { name: 'Export CSV' })
    act(() => useGameStore.setState({ myAlias: 'P1' }))
    act(() => useGameStore.setState({ myAlias: 'P2' }))
    await settleAll()
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument()
    expect(asked()).toHaveLength(1)
  })

  it("never shows the previous account's yes after signing in as someone else", async () => {
    let answerSecond: ((reply: Reply) => void) | null = null
    let calls = 0
    spy = serve(() => {
      calls += 1
      if (calls === 1) return { status: 204 }
      return new Promise<Reply>((resolve) => {
        answerSecond = resolve
      })
    })
    finishedInStore()
    mount(PAGE)
    expect(await screen.findByRole('button', { name: 'Export CSV' })).toBeInTheDocument()

    // Another account signs in on the same page: a new user object, the same game.
    auth.user = { displayName: 'Beto Ruiz', email: 'beto@example.com', photoURL: null }
    act(() => useGameStore.setState({ myAlias: 'P1' }))
    await waitFor(() => expect(answerSecond).not.toBeNull())
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument()

    await act(async () => {
      answerSecond!({ status: 404, data: NOT_FOUND })
    })
    await settleAll()
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument()
    expect(asked()).toHaveLength(2)
  })

  it('ignores a late answer for a game the page has moved away from', async () => {
    let answerFirst: ((reply: Reply) => void) | null = null
    spy = serve((id) =>
      id === GAME_ID
        ? new Promise<Reply>((resolve) => {
            answerFirst = resolve
          })
        : { status: 404, data: NOT_FOUND },
    )
    const { router } = mount(PAGE)
    await waitFor(() => expect(answerFirst).not.toBeNull())
    await act(async () => {
      await router.navigate(`/results/${OTHER_GAME}`)
    })
    await waitFor(() => expect(asked().map(urlPath)).toEqual([HOSTED, `${HOSTED_PREFIX}${OTHER_GAME}`]))
    await settleAll()
    await act(async () => {
      answerFirst!({ status: 204 })
    })
    await settleAll()
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument()
  })
})

describe('the same figures on both paths (criterion 2)', () => {
  it('shows the same pulquería names and the same profits live and fetched', async () => {
    window.sessionStorage.clear()
    finishedInStore()
    const live = mount(PAGE)
    const liveNames = Object.values(NAMES).map((n) => screen.getAllByText(n).length)
    const liveProfit = onScreen(TOP_PROFIT).length
    live.unmount()

    useGameStore.setState({ ...INITIAL_STATE })
    spy = mockHttp(() => ({ status: 200, data: makeResponse() }))
    mount(PAGE)
    await screen.findAllByText(NAMES.P2)
    expect(Object.values(NAMES).map((n) => screen.getAllByText(n).length)).toEqual(liveNames)
    expect(onScreen(TOP_PROFIT).length).toBe(liveProfit)
  })
})
