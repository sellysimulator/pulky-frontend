/**
 * The multi-game host flow: one config, N games (`POST /rooms/batch-create`), and a
 * dashboard above each game's unchanged host screen. Seats and status come from
 * `POST /rooms/summary`; a host screen opens in its own tab, which only works if the
 * browser copies this tab's sessionStorage, so the opener must be kept (no `noopener`).
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase', () => ({ auth: { currentUser: null }, googleProvider: {}, app: {} }))
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    loading: false,
    mode: 'authenticated',
    user: { displayName: 'Ana Perez', email: 'ana@example.com', photoURL: null },
    signInWithGoogle: async () => undefined,
    continueAsGuest: () => undefined,
    signOut: async () => undefined,
  }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('react-chartjs-2', () => ({
  Bar: () => <canvas data-testid="chart-canvas" />,
  Line: () => <canvas data-testid="chart-canvas" />,
}))
vi.mock('../api/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/config')>()),
  getConfigDefaults: vi.fn(),
  validateConfig: vi.fn(),
  previewConfig: vi.fn(),
}))
vi.mock('../api/rooms', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/rooms')>()),
  createRoomBatch: vi.fn(),
  getRoomsSummary: vi.fn(),
}))

import { getConfigDefaults, previewConfig, validateConfig } from '../api/config'
import { createRoomBatch, getRoomsSummary } from '../api/rooms'
import { socket } from '../api/socket'
import '../api/socketHandlers'
import { DOCS } from '../components/config/docs/entries'
import { openHostScreen, startAllStatus, statusLabel } from '../components/multihost/multihost'
import HomePage from '../pages/HomePage'
import MultiHostDashboard, { route as dashboardRoute } from '../pages/MultiHostDashboard'
import MultiHostSetup, { route as setupRoute } from '../pages/MultiHostSetup'
import { INITIAL_STATE, useGameStore } from '../store/gameStore'
import type { CreateRoomResponse, RoomSummary } from '../types/game'
import { clearHostBatch, clearPulkyStorage, getHostBatch, getHostSecret, setHostBatch, setHostSecret } from '../utils/storage'
import { DEFAULTS_RESPONSE, SERVER_LIMITS, seedServerLimits } from './fixtures/serverConfig'

const A = 'AAAAA2'
const B = 'BBBBB3'
const C = 'CCCCC4'

function summary(room_code: string, over: Partial<RoomSummary> = {}): RoomSummary {
  return {
    room_code,
    exists: true,
    state: 'lobby',
    seats_taken: 0,
    seats_total: 4,
    day: 0,
    duration_days: 14,
    finished: false,
    can_start: false,
    start_blocked_reason: 'Waiting for at least 2 players.',
    ...over,
  }
}

function gone(room_code: string): RoomSummary {
  return {
    room_code,
    exists: false,
    state: null,
    seats_taken: null,
    seats_total: null,
    day: null,
    duration_days: null,
    finished: null,
    can_start: null,
    start_blocked_reason: null,
  }
}

function created(room_code: string, host_secret: string): CreateRoomResponse {
  return { room_code, host_secret, state: 'lobby', config: structuredClone(DEFAULTS_RESPONSE.config) }
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/multihost/new', element: <MultiHostSetup /> },
      { path: '/multihost', element: <MultiHostDashboard /> },
      { path: '/home', element: <HomePage /> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

let emit: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  useGameStore.setState({ ...INITIAL_STATE })
  seedServerLimits()
  emit = vi.spyOn(socket, 'emit').mockImplementation(() => socket)
  vi.mocked(getConfigDefaults).mockResolvedValue(structuredClone(DEFAULTS_RESPONSE))
  vi.mocked(validateConfig).mockResolvedValue({ ok: true, errors: [], warnings: [] })
  vi.mocked(previewConfig).mockResolvedValue({ preview: null })
  vi.mocked(getRoomsSummary).mockResolvedValue([])
})

afterEach(() => {
  emit.mockRestore()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('routes', () => {
  it('registers both pages behind sign-in and an awake backend', () => {
    expect(setupRoute).toEqual({ path: '/multihost/new', guard: 'auth+backend' })
    expect(dashboardRoute).toEqual({ path: '/multihost', guard: 'auth+backend' })
  })
})

describe('batch storage', () => {
  it('keeps the batch codes in this tab, upper-cased, and clears them', () => {
    expect(getHostBatch()).toBeNull()
    setHostBatch([A, 'bbbbb3'])
    expect(sessionStorage.getItem('pulky.host_batch')).toBe(JSON.stringify([A, B]))
    expect(localStorage.getItem('pulky.host_batch')).toBeNull()
    expect(getHostBatch()).toEqual([A, B])
    clearHostBatch()
    expect(getHostBatch()).toBeNull()
  })

  it('treats a malformed or empty stored batch as none', () => {
    sessionStorage.setItem('pulky.host_batch', '{not json')
    expect(getHostBatch()).toBeNull()
    sessionStorage.setItem('pulky.host_batch', '[1, 2]')
    expect(getHostBatch()).toBeNull()
    sessionStorage.setItem('pulky.host_batch', '[]')
    expect(getHostBatch()).toBeNull()
  })

  it('is forgotten on sign-out with every other pulky key', () => {
    setHostBatch([A])
    clearPulkyStorage()
    expect(getHostBatch()).toBeNull()
  })
})

describe('statusLabel', () => {
  it('names each state from the server summary', () => {
    expect(statusLabel(undefined)).toBe('Loading…')
    expect(statusLabel(gone('x'))).toBe('Expired or not found')
    expect(statusLabel(summary('x'))).toBe('Waiting for players')
    expect(statusLabel(summary('x', { can_start: true }))).toBe('Ready to start')
    expect(statusLabel(summary('x', { state: 'running', day: 3, duration_days: 14 }))).toBe('Day 3 of 14')
    expect(statusLabel(summary('x', { state: 'finished', finished: true }))).toBe('Finished')
  })
})

describe('openHostScreen', () => {
  it('opens the host screen in a new tab keeping the opener, so the secrets are copied', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    openHostScreen(A)
    expect(open).toHaveBeenCalledTimes(1)
    expect(open.mock.calls[0]).toEqual([`/host/${A}`, '_blank'])
  })
})

describe('MultiHostSetup', () => {
  it('creates the batch with the config patch, stores each secret and goes to the dashboard', async () => {
    vi.mocked(createRoomBatch).mockResolvedValue({ rooms: [created(A, 'secret-a'), created(B, 'secret-b')] })
    const user = userEvent.setup()
    renderAt('/multihost/new')

    const count = await screen.findByLabelText('Number of games')
    expect(count).toHaveValue(String(SERVER_LIMITS.MIN_BATCH_ROOMS))
    await user.clear(count)
    await user.type(count, '2')
    await user.type(screen.getByLabelText('Your name'), 'Ms. Ruiz')
    const days = screen.getByLabelText(DOCS.duration_days.label)
    await user.clear(days)
    await user.type(days, '9')
    await waitFor(() => expect(validateConfig).toHaveBeenCalled())
    await user.click(await screen.findByRole('button', { name: 'Create 2 games' }))

    await waitFor(() => expect(createRoomBatch).toHaveBeenCalledTimes(1))
    expect(createRoomBatch).toHaveBeenCalledWith(2, { duration_days: 9 }, 'Ms. Ruiz')
    expect(await screen.findByRole('heading', { name: 'Your games' })).toBeInTheDocument()
    expect(getHostSecret(A)).toBe('secret-a')
    expect(getHostSecret(B)).toBe('secret-b')
    expect(getHostBatch()).toEqual([A, B])
  })

  it('sends an empty patch when the defaults are kept', async () => {
    vi.mocked(createRoomBatch).mockResolvedValue({ rooms: [created(A, 'a'), created(B, 'b')] })
    const user = userEvent.setup()
    renderAt('/multihost/new')
    await user.click(await screen.findByRole('button', { name: `Create ${SERVER_LIMITS.MIN_BATCH_ROOMS} games` }))
    await waitFor(() => expect(createRoomBatch).toHaveBeenCalledWith(SERVER_LIMITS.MIN_BATCH_ROOMS, {}, undefined))
  })

  it('disables Create while the count or a setting is out of range', async () => {
    const user = userEvent.setup()
    renderAt('/multihost/new')

    const count = await screen.findByLabelText('Number of games')
    await user.clear(count)
    await user.type(count, String(SERVER_LIMITS.MAX_BATCH_ROOMS + 1))
    expect(screen.getByRole('button', { name: 'Create games' })).toBeDisabled()
    expect(
      screen.getByText(`Must be between ${SERVER_LIMITS.MIN_BATCH_ROOMS} and ${SERVER_LIMITS.MAX_BATCH_ROOMS}.`),
    ).toBeInTheDocument()

    await user.clear(count)
    await user.type(count, '3')
    expect(screen.getByRole('button', { name: 'Create 3 games' })).toBeEnabled()

    vi.mocked(validateConfig).mockResolvedValue({
      ok: false,
      errors: [{ field: 'duration_days', message: 'Must be between 7 and 60.' }],
      warnings: [],
    })
    const days = screen.getByLabelText(DOCS.duration_days.label)
    await user.clear(days)
    await user.type(days, '3')
    expect(await screen.findByText('Must be between 7 and 60.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create 3 games' })).toBeDisabled()
  })

  it('shows the server refusal and stores nothing', async () => {
    vi.mocked(createRoomBatch).mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { detail: 'Must be between 2 and 12.', field: 'max_players' } },
    })
    const user = userEvent.setup()
    renderAt('/multihost/new')

    await user.click(await screen.findByRole('button', { name: /^Create/ }))

    expect(await screen.findByText('Must be between 2 and 12.')).toBeInTheDocument()
    expect(getHostBatch()).toBeNull()
  })

  it('stores nothing when a room comes back without a secret', async () => {
    vi.mocked(createRoomBatch).mockResolvedValue({ rooms: [created(A, 'secret-a'), created(B, '')] })
    const user = userEvent.setup()
    renderAt('/multihost/new')

    await user.click(await screen.findByRole('button', { name: /^Create/ }))

    expect(await screen.findByText(/no host secret/)).toBeInTheDocument()
    expect(getHostBatch()).toBeNull()
    expect(getHostSecret(A)).toBeNull()
  })
})

describe('MultiHostDashboard', () => {
  function seedBatch() {
    setHostBatch([A, B, C])
    setHostSecret(A, 'secret-a')
    setHostSecret(B, 'secret-b')
    setHostSecret(C, 'secret-c')
  }

  it('sends to the setup page when this tab has no batch', async () => {
    renderAt('/multihost')
    expect(await screen.findByLabelText('Number of games')).toBeInTheDocument()
    expect(getRoomsSummary).not.toHaveBeenCalled()
  })

  it('shows a card per game with its code, link, seats and status', async () => {
    seedBatch()
    vi.mocked(getRoomsSummary).mockResolvedValue([
      summary(A, { seats_taken: 2, can_start: true, start_blocked_reason: null }),
      summary(B, { seats_taken: 1 }),
      gone(C),
    ])
    renderAt('/multihost')

    expect(getRoomsSummary).toHaveBeenCalledWith([
      { room_code: A, host_secret: 'secret-a' },
      { room_code: B, host_secret: 'secret-b' },
      { room_code: C, host_secret: 'secret-c' },
    ])

    const first = within(screen.getByRole('article', { name: 'Game 1' }))
    expect(first.getByText(A)).toBeInTheDocument()
    expect(first.getByLabelText(`Invite link for game ${A}`)).toHaveTextContent(`${window.location.origin}/join/${A}`)
    expect(await first.findByText('Ready to start')).toBeInTheDocument()
    expect(first.getByLabelText('Players')).toHaveTextContent('2 / 4')

    const second = within(screen.getByRole('article', { name: 'Game 2' }))
    expect(second.getByLabelText('Players')).toHaveTextContent('1 / 4')
    expect(second.getByText('Waiting for players')).toBeInTheDocument()

    const third = within(screen.getByRole('article', { name: 'Game 3' }))
    expect(third.getByText('Expired or not found')).toBeInTheDocument()
    expect(third.getByRole('button', { name: 'Open host screen' })).toBeDisabled()
  })

  it('never puts a host secret on the page', async () => {
    seedBatch()
    vi.mocked(getRoomsSummary).mockResolvedValue([summary(A), summary(B), summary(C)])
    const { container } = render(
      <RouterProvider router={createMemoryRouter([{ path: '/multihost', element: <MultiHostDashboard /> }], { initialEntries: ['/multihost'] })} />,
    )
    await screen.findAllByText('Waiting for players')
    fireEvent.click(screen.getByRole('button', { name: `Show QR code for game ${A}` }))
    expect(document.body.innerHTML).not.toContain('secret-')
    expect(container.innerHTML).not.toContain('secret-')
  })

  it('starts only the games that are ready, with the ordinary start_game', async () => {
    seedBatch()
    vi.mocked(getRoomsSummary).mockResolvedValue([
      summary(A, { seats_taken: 2, can_start: true }),
      summary(B, { seats_taken: 1 }),
      summary(C, { seats_taken: 3, can_start: true }),
    ])
    renderAt('/multihost')

    fireEvent.click(await screen.findByRole('button', { name: 'Start all ready games (2)' }))

    expect(emit.mock.calls).toEqual([
      ['start_game', { room_id: A, host_secret: 'secret-a' }],
      ['start_game', { room_id: C, host_secret: 'secret-c' }],
    ])
  })

  it('cannot start anything while no game is ready', async () => {
    seedBatch()
    vi.mocked(getRoomsSummary).mockResolvedValue([summary(A), summary(B), summary(C)])
    renderAt('/multihost')

    await waitFor(() => expect(getRoomsSummary).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: 'Start all ready games (0)' })).toBeDisabled()
  })

  it('copies a game invite link', async () => {
    seedBatch()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderAt('/multihost')

    const card = within(screen.getByRole('article', { name: 'Game 2' }))
    fireEvent.click(card.getByRole('button', { name: 'Copy link' }))

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/join/${B}`)
    await waitFor(() => expect(useGameStore.getState().alerts.map((a) => a.message)).toEqual(['Copied.']))
  })

  it('shows a QR code per game and enlarges it on demand', async () => {
    seedBatch()
    vi.mocked(getRoomsSummary).mockResolvedValue([summary(A), summary(B), gone(C)])
    renderAt('/multihost')

    const second = within(screen.getByRole('article', { name: 'Game 2' }))
    const inline = second.getByRole('button', { name: `Show QR code for game ${B}` })
    expect(inline.querySelector('svg')).not.toBeNull()

    fireEvent.click(second.getByRole('button', { name: 'Show QR' }))
    const dialog = screen.getByRole('dialog', { name: `QR code to join room ${B}` })
    expect(dialog).toHaveTextContent(`${window.location.origin}/join/${B}`)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(inline)
    const again = screen.getByRole('dialog', { name: `QR code to join room ${B}` })
    fireEvent.keyDown(again, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(inline)
    const third = screen.getByRole('dialog', { name: `QR code to join room ${B}` })
    fireEvent.click(third) // the backdrop
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Nobody can join a room that is gone, so it gets no QR code.
    const gameThree = within(screen.getByRole('article', { name: 'Game 3' }))
    await waitFor(() => expect(gameThree.getByText('Expired or not found')).toBeInTheDocument())
    expect(gameThree.queryByRole('button', { name: /Show QR code/ })).not.toBeInTheDocument()
    expect(gameThree.getByRole('button', { name: 'Show QR' })).toBeDisabled()
  })

  it('opens a game host screen in a new tab', async () => {
    seedBatch()
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderAt('/multihost')

    const card = within(screen.getByRole('article', { name: 'Game 3' }))
    const button = card.getByRole('button', { name: 'Open host screen' })
    expect(button.tagName).toBe('BUTTON')
    fireEvent.click(button)

    expect(open).toHaveBeenCalledWith(`/host/${C}`, '_blank')
    expect(getHostSecret(C)).toBe('secret-c') // what the new tab inherits
  })

  it('forgets an old room in this tab and reconnects, leaving its channel', () => {
    seedBatch()
    const disconnect = vi.spyOn(socket, 'disconnect').mockImplementation(() => socket)
    const connect = vi.spyOn(socket, 'connect').mockImplementation(() => socket)
    vi.spyOn(socket, 'active', 'get').mockReturnValue(true)
    useGameStore.getState().setRoom('ZZZZZ9', true)
    renderAt('/multihost')
    expect(useGameStore.getState().roomCode).toBeNull()
    expect(disconnect).toHaveBeenCalledTimes(1)
    expect(connect).toHaveBeenCalledTimes(1)
  })

  it('leaves the socket alone when this tab was in no room', () => {
    seedBatch()
    const disconnect = vi.spyOn(socket, 'disconnect').mockImplementation(() => socket)
    renderAt('/multihost')
    expect(disconnect).not.toHaveBeenCalled()
  })

  it('New batch clears the batch and goes back to the setup page', async () => {
    seedBatch()
    const router = renderAt('/multihost')
    fireEvent.click(screen.getByRole('button', { name: 'New batch' }))
    expect(getHostBatch()).toBeNull()
    await waitFor(() => expect(router.state.location.pathname).toBe('/multihost/new'))
  })

  it('shows a failed refresh and polls again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    seedBatch()
    vi.mocked(getRoomsSummary)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue([summary(A, { seats_taken: 1 })])
    renderAt('/multihost')

    expect(await screen.findByText('Could not refresh the games.')).toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    await waitFor(() => expect(screen.queryByText('Could not refresh the games.')).not.toBeInTheDocument())
    expect(getRoomsSummary).toHaveBeenCalledTimes(2)
  })
})

describe('Start all: refusals on their cards (spec §11.3)', () => {
  const NEED_TWO = 'Waiting for at least 2 players.'

  function seedBatch() {
    setHostBatch([A, B, C])
    setHostSecret(A, 'secret-a')
    setHostSecret(B, 'secret-b')
    setHostSecret(C, 'secret-c')
  }

  /** The server's `join_error`, through the app's one listener (socketHandlers). */
  function refuse(payload: { message: string; room_code?: string }) {
    const listeners = socket.listeners('join_error')
    expect(listeners).toHaveLength(1)
    act(() => {
      for (const fn of listeners) fn(payload)
    })
  }

  const card = (n: number) => within(screen.getByRole('article', { name: `Game ${n}` }))
  const allReady = () => [A, B, C].map((code) => summary(code, { seats_taken: 2, can_start: true, start_blocked_reason: null }))

  it('shows a start refused mid-batch on that card only, then the status line', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    seedBatch()
    vi.mocked(getRoomsSummary)
      .mockResolvedValueOnce(allReady())
      .mockResolvedValue([
        summary(A, { state: 'running', day: 1 }),
        summary(B, { seats_taken: 1 }),
        summary(C, { state: 'running', day: 1 }),
      ])
    renderAt('/multihost')
    fireEvent.click(await screen.findByRole('button', { name: 'Start all ready games (3)' }))
    expect(emit.mock.calls.map((c: unknown[]) => c[1])).toEqual([
      { room_id: A, host_secret: 'secret-a' },
      { room_id: B, host_secret: 'secret-b' },
      { room_id: C, host_secret: 'secret-c' },
    ])

    // A player left B meanwhile: its start is refused.
    refuse({ message: NEED_TWO, room_code: B })
    expect(card(2).getByRole('alert')).toHaveTextContent(`Game 2 (${B}): ${NEED_TWO}`)
    expect(card(1).queryByRole('alert')).toBeNull()
    expect(card(3).queryByRole('alert')).toBeNull()
    expect(useGameStore.getState().alerts).toHaveLength(0)
    expect(useGameStore.getState().joinError).toBeNull()

    // Counted from the summary after the starts.
    expect(screen.queryByRole('status')).toBeNull()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(await screen.findByText("Started 2 of 3 games. 1 couldn't start, see their cards.")).toBeInTheDocument()
    expect(card(2).getByRole('alert')).toHaveTextContent(NEED_TWO)
  })

  it("clears a card's refusal once a later summary shows the game started", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    seedBatch()
    vi.mocked(getRoomsSummary)
      .mockResolvedValueOnce(allReady())
      .mockResolvedValue([summary(A), summary(B, { state: 'running', day: 1 }), summary(C)])
    renderAt('/multihost')
    await screen.findByRole('button', { name: 'Start all ready games (3)' })
    refuse({ message: NEED_TWO, room_code: B })
    expect(card(2).getByRole('alert')).toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    await waitFor(() => expect(card(2).queryByRole('alert')).toBeNull())
  })

  it('keeps the global alert for a refusal without a room_code or for a room outside the batch', async () => {
    seedBatch()
    vi.mocked(getRoomsSummary).mockResolvedValue(allReady())
    renderAt('/multihost')
    await screen.findByRole('button', { name: 'Start all ready games (3)' })
    refuse({ message: 'Only the host can do that.' })
    refuse({ message: NEED_TWO, room_code: 'ZZZZZ9' })
    expect(useGameStore.getState().alerts.map((a) => a.message)).toEqual(['Only the host can do that.', NEED_TWO])
    for (const n of [1, 2, 3]) expect(card(n).queryByRole('alert')).toBeNull()
  })

  it('outside the dashboard every refusal goes to the store as before', () => {
    refuse({ message: NEED_TWO, room_code: A })
    expect(useGameStore.getState().joinError).toBe(NEED_TWO)
  })

  it('words the status line', () => {
    expect(startAllStatus(3, 3)).toBe('Started 3 of 3 games.')
    expect(startAllStatus(1, 3)).toBe("Started 1 of 3 games. 2 couldn't start, see their cards.")
  })
})

describe('HomePage', () => {
  it('links to the multi-game setup', async () => {
    const router = renderAt('/home')
    const card = screen.getByRole('region', { name: 'Host several games' })
    fireEvent.click(within(card).getByRole('button', { name: 'Set up several games' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/multihost/new'))
  })
})
