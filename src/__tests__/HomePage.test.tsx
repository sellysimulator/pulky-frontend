/**
 * Section 22 — HomePage (design.md §8.2, spec §11.3). Acceptance criteria 8, 9;
 * failure mode 8. Requests are observed through the axios instance's adapter
 * (section 21, 3.3a), never by mocking axios or the REST clients.
 */
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { render, screen, waitFor, within } from '@testing-library/react'
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

import http from '../api/http'
import HomePage, { route } from '../pages/HomePage'
import { LIMITS } from '../types/game'
import { getHostSecret, setSessionToken } from '../utils/storage'

const originalAdapter = http.defaults.adapter
let seen: InternalAxiosRequestConfig[] = []
let handler: (cfg: InternalAxiosRequestConfig) => { status: number; data: unknown }

const path = (cfg: InternalAxiosRequestConfig) => (cfg.url ?? '').replace(/^\/+/, '').split('?')[0]
const method = (cfg: InternalAxiosRequestConfig) => (cfg.method ?? '').toUpperCase()
function body(cfg: InternalAxiosRequestConfig): Record<string, unknown> {
  if (cfg.data === undefined || cfg.data === null || cfg.data === '') return {}
  return (typeof cfg.data === 'string' ? JSON.parse(cfg.data) : cfg.data) as Record<string, unknown>
}

beforeEach(() => {
  seen = []
  handler = () => ({ status: 200, data: {} })
  const adapter: AxiosAdapter = async (config) => {
    seen.push(config)
    const { status, data } = handler(config)
    const response = { data, status, statusText: String(status), headers: {}, config }
    if (status >= 400) throw new AxiosError(`HTTP ${status}`, String(status), config, null, response)
    return response
  }
  http.defaults.adapter = adapter
})

afterEach(() => {
  http.defaults.adapter = originalAdapter
})

function renderHome() {
  const router = createMemoryRouter(
    [
      { path: '/home', element: <HomePage /> },
      { path: '/game/:code', element: <p>game page</p> },
      { path: '/host/:code', element: <p>host page</p> },
    ],
    { initialEntries: ['/home'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

const status = (over: Record<string, unknown>) => ({
  ok: true,
  state: 'lobby',
  host_display_name: null,
  seats_taken: 0,
  seats_total: 4,
  ...over,
})

const statusCalls = () => seen.filter((c) => method(c) === 'GET' && /^rooms\/[^/]+\/status$/.test(path(c)))

async function join(code: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Room code'), code)
  await user.click(screen.getByRole('button', { name: 'Join' }))
}

describe('the route descriptor', () => {
  it('needs sign-in and a awake backend', () => {
    expect(route).toEqual({ path: '/home', guard: 'auth+backend' })
  })
})

describe('layout', () => {
  it('has the app header, the Join a room card and the Create a room card', () => {
    renderHome()
    expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Join a room' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Create a room' })).toBeInTheDocument()
  })

  it('links both manuals', () => {
    renderHome()
    const nav = screen.getByRole('navigation', { name: 'Manuals' })
    expect(within(nav).getByRole('link', { name: 'Player manual' })).toHaveAttribute('href', '/player-manual')
    expect(within(nav).getByRole('link', { name: 'Host manual' })).toHaveAttribute('href', '/host-manual')
  })

  it('Join is the primary action and Create room the secondary one', () => {
    renderHome()
    expect(within(screen.getByRole('region', { name: 'Join a room' })).getByRole('button', { name: 'Join' })).toHaveClass('bg-accent')
    const create = within(screen.getByRole('region', { name: 'Create a room' })).getByRole('button', { name: 'Create room' })
    expect(create).not.toHaveClass('bg-accent')
  })

  it('Join a room comes before Create a room', () => {
    renderHome()
    const regions = screen.getAllByRole('region')
    const names = regions.map((r) => r.getAttribute('aria-label') ?? r.querySelector('h2')?.textContent)
    expect(names.indexOf('Join a room')).toBeLessThan(names.indexOf('Create a room'))
  })
})

describe('the room code field', () => {
  it('upper-cases as typed', async () => {
    renderHome()
    await userEvent.type(screen.getByLabelText('Room code'), 'abc234')
    expect(screen.getByLabelText('Room code')).toHaveValue('ABC234')
  })

  it('holds at most 6 characters', async () => {
    renderHome()
    await userEvent.type(screen.getByLabelText('Room code'), 'abc2345pq')
    expect(screen.getByLabelText('Room code')).toHaveValue('ABC234')
  })

  it('accepts only the alphabet of spec §11.3 (no 0, 1, I, L or O)', async () => {
    renderHome()
    await userEvent.type(screen.getByLabelText('Room code'), 'a1o0b-il')
    expect(screen.getByLabelText('Room code')).toHaveValue('AB')
  })
})

describe('Join a room (criterion 8)', () => {
  it('asks the server for the status of the upper-cased code', async () => {
    handler = () => ({ status: 200, data: status({ ok: true }) })
    renderHome()
    await join('abc234')
    await waitFor(() => expect(statusCalls()).toHaveLength(1))
    expect(path(statusCalls()[0])).toBe('rooms/ABC234/status')
  })

  it('navigates to /game/:code when the room is joinable', async () => {
    handler = () => ({ status: 200, data: status({ ok: true }) })
    const router = renderHome()
    await join('abc234')
    await waitFor(() => expect(router.state.location.pathname).toBe('/game/ABC234'))
    expect(screen.getByText('game page')).toBeInTheDocument()
  })

  it('submitting the form with Enter joins too', async () => {
    handler = () => ({ status: 200, data: status({ ok: true }) })
    const router = renderHome()
    await userEvent.type(screen.getByLabelText('Room code'), 'abc234{Enter}')
    await waitFor(() => expect(router.state.location.pathname).toBe('/game/ABC234'))
  })

  it('shows the reason verbatim as a danger alert when the room is full (worked example)', async () => {
    handler = () => ({ status: 200, data: status({ ok: false, reason: 'This room is full.' }) })
    const router = renderHome()
    await join('abc234')
    expect(await screen.findByText('This room is full.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('This room is full.')
    expect(router.state.location.pathname).toBe('/home')
  })

  it('failure mode 8: an unknown room does not navigate and says why', async () => {
    handler = () => ({ status: 200, data: status({ ok: false, reason: 'No room with that code.', state: null }) })
    const router = renderHome()
    await join('abc234')
    expect(await screen.findByText('No room with that code.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/home')
    expect(screen.queryByText('game page')).not.toBeInTheDocument()
  })

  it('a returning player (stored session token for that code) goes to the game although the status refuses (worked example)', async () => {
    setSessionToken('ABC234', 'tok-1')
    handler = () => ({ status: 200, data: status({ ok: false, reason: 'This game has already started.', state: 'running' }) })
    const router = renderHome()
    await join('abc234')
    await waitFor(() => expect(router.state.location.pathname).toBe('/game/ABC234'))
    expect(screen.queryByText('This game has already started.')).not.toBeInTheDocument()
  })

  it('a session token for another room does not count', async () => {
    setSessionToken('XYZ789', 'tok-other')
    handler = () => ({ status: 200, data: status({ ok: false, reason: 'This game has already started.', state: 'running' }) })
    const router = renderHome()
    await join('abc234')
    expect(await screen.findByText('This game has already started.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/home')
  })

  it('a request error shows the fallback message and does not navigate', async () => {
    handler = () => ({ status: 503, data: 'down' })
    const router = renderHome()
    await join('abc234')
    expect(await screen.findByText('Could not reach the game server.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/home')
  })

  it('a request error with a string detail shows the detail', async () => {
    handler = () => ({ status: 429, data: { detail: 'Slow down.' } })
    renderHome()
    await join('abc234')
    expect(await screen.findByText('Slow down.')).toBeInTheDocument()
  })

  it('a 422 array detail renders as a string, not an object', async () => {
    handler = () => ({ status: 422, data: { detail: [{ msg: 'bad code' }, { msg: 'too short' }] } })
    renderHome()
    await join('abc234')
    expect(await screen.findByText('bad code; too short')).toBeInTheDocument()
  })

  it('a later successful attempt clears the earlier reason', async () => {
    let n = 0
    handler = () => ({ status: 200, data: status(n++ === 0 ? { ok: false, reason: 'This room is full.' } : { ok: true }) })
    const router = renderHome()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Room code'), 'abc234')
    await user.click(screen.getByRole('button', { name: 'Join' }))
    expect(await screen.findByText('This room is full.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Join' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/game/ABC234'))
  })
})

describe('Create a room (criterion 9)', () => {
  const created = { room_code: 'KQ7M2P', host_secret: 'secret-xyz', state: 'lobby', config: {} }

  it('the name field is optional and limited to LIMITS.MAX_DISPLAY_NAME', () => {
    renderHome()
    const name = screen.getByLabelText('Your name')
    expect(name).not.toBeRequired()
    expect(name).toHaveAttribute('maxlength', String(LIMITS.MAX_DISPLAY_NAME))
  })

  it('posts the name, stores the host secret for the returned code and goes to /host/:code', async () => {
    handler = () => ({ status: 200, data: created })
    const router = renderHome()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Your name'), 'Don Agave')
    await user.click(screen.getByRole('button', { name: 'Create room' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/host/KQ7M2P'))
    const call = seen.find((c) => method(c) === 'POST' && path(c) === 'rooms/create')!
    expect(body(call)).toEqual({ host_display_name: 'Don Agave' })
    expect(getHostSecret('KQ7M2P')).toBe('secret-xyz')
    expect(getHostSecret('ABC234')).toBeNull()
  })

  it('keeps the host secret out of localStorage', async () => {
    handler = () => ({ status: 200, data: created })
    const router = renderHome()
    await userEvent.click(screen.getByRole('button', { name: 'Create room' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/host/KQ7M2P'))
    for (let i = 0; i < localStorage.length; i++) {
      expect(localStorage.getItem(localStorage.key(i)!)).not.toBe('secret-xyz')
    }
  })

  it('works with no name', async () => {
    handler = () => ({ status: 200, data: created })
    const router = renderHome()
    await userEvent.click(screen.getByRole('button', { name: 'Create room' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/host/KQ7M2P'))
    const call = seen.find((c) => method(c) === 'POST' && path(c) === 'rooms/create')!
    expect(body(call).host_display_name ?? '').toBe('')
  })

  it('a failure shows the fallback message, stores nothing and does not navigate', async () => {
    handler = () => ({ status: 500, data: {} })
    const router = renderHome()
    await userEvent.click(screen.getByRole('button', { name: 'Create room' }))
    expect(await screen.findByText('Could not create the room. Try again.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/home')
    expect(sessionStorage.length).toBe(0)
  })

  it('a failure with a string detail shows the detail', async () => {
    handler = () => ({ status: 429, data: { detail: 'Too many rooms.' } })
    renderHome()
    await userEvent.click(screen.getByRole('button', { name: 'Create room' }))
    expect(await screen.findByText('Too many rooms.')).toBeInTheDocument()
  })

  it('does not call the join status endpoint', async () => {
    handler = () => ({ status: 200, data: created })
    const router = renderHome()
    await userEvent.click(screen.getByRole('button', { name: 'Create room' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/host/KQ7M2P'))
    expect(statusCalls()).toHaveLength(0)
  })
})
