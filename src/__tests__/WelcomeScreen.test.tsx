/**
 * Section 22 — WelcomeScreen (design.md §8.1, spec §13.6 "Skip the welcome
 * screen when identity is known"). Acceptance criterion 7; failure modes 5, 6.
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase', () => ({ auth: { currentUser: null }, googleProvider: {}, app: {} }))

const h = vi.hoisted(() => ({
  auth: {
    loading: false,
    mode: null as 'authenticated' | 'guest' | null,
    signInWithGoogle: vi.fn<() => Promise<void>>(async () => undefined),
    continueAsGuest: vi.fn<() => void>(() => undefined),
  },
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    loading: h.auth.loading,
    mode: h.auth.mode,
    user: null,
    signInWithGoogle: h.auth.signInWithGoogle,
    continueAsGuest: h.auth.continueAsGuest,
    signOut: async () => undefined,
  }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

import WelcomeScreen, { route } from '../pages/WelcomeScreen'

const TAGLINE = 'Run a pulquería: buy, ship and sell pulque before it spoils.'

function renderAt(entry: string | { pathname: string; state?: unknown } = '/') {
  const router = createMemoryRouter(
    [
      { path: '/', element: <WelcomeScreen /> },
      { path: '/home', element: <p>home page</p> },
      { path: '/game/:code', element: <p>game page</p> },
    ],
    { initialEntries: [entry] },
  )
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  h.auth.loading = false
  h.auth.mode = null
  h.auth.signInWithGoogle.mockReset()
  h.auth.signInWithGoogle.mockResolvedValue(undefined)
  h.auth.continueAsGuest.mockReset()
})

describe('the route descriptor', () => {
  it('is public at /', () => {
    expect(route).toEqual({ path: '/', guard: 'public' })
  })
})

describe('copy (section 3.4)', () => {
  it('shows the wordmark, the tagline and both sign-in buttons', () => {
    renderAt()
    expect(screen.getByText('Pulky')).toBeInTheDocument()
    expect(screen.getByText(TAGLINE)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play as guest' })).toBeInTheDocument()
  })

  it('Continue with Google is the primary action, Play as guest the secondary', () => {
    renderAt()
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toHaveClass('bg-accent')
    expect(screen.getByRole('button', { name: 'Play as guest' })).not.toHaveClass('bg-accent')
  })

  it('links both manuals, which need no sign-in', () => {
    renderAt()
    const nav = screen.getByRole('navigation', { name: 'Manuals' })
    expect(within(nav).getByRole('link', { name: 'Player manual' })).toHaveAttribute('href', '/player-manual')
    expect(within(nav).getByRole('link', { name: 'Host manual' })).toHaveAttribute('href', '/host-manual')
  })
})

describe('an authenticated visitor (criterion 7)', () => {
  it('is sent to /home, replacing the history entry', async () => {
    h.auth.mode = 'authenticated'
    const router = renderAt()
    await waitFor(() => expect(router.state.location.pathname).toBe('/home'))
    expect(router.state.historyAction).toBe('REPLACE')
    expect(screen.getByText('home page')).toBeInTheDocument()
  })

  it('failure mode 6: goes back to the invite link in state.from, not to /home', async () => {
    h.auth.mode = 'authenticated'
    const router = renderAt({ pathname: '/', state: { from: '/game/ABC234' } })
    await waitFor(() => expect(router.state.location.pathname).toBe('/game/ABC234'))
    expect(router.state.historyAction).toBe('REPLACE')
    expect(screen.getByText('game page')).toBeInTheDocument()
  })

  it('accepts the location object a guard stores in state.from, search included', async () => {
    h.auth.mode = 'authenticated'
    const router = renderAt({ pathname: '/', state: { from: { pathname: '/game/XYZ789', search: '?x=1', hash: '' } } })
    await waitFor(() => expect(router.state.location.pathname).toBe('/game/XYZ789'))
    expect(router.state.location.search).toBe('?x=1')
  })

  it('failure mode 5: does not navigate while auth is still loading', async () => {
    h.auth.loading = true
    h.auth.mode = 'authenticated'
    const router = renderAt({ pathname: '/', state: { from: '/game/ABC234' } })
    await new Promise((r) => setTimeout(r, 30))
    expect(router.state.location.pathname).toBe('/')
    expect(screen.queryByText('home page')).not.toBeInTheDocument()
    expect(screen.queryByText('game page')).not.toBeInTheDocument()
  })

  it('navigates once loading finishes', async () => {
    h.auth.loading = true
    h.auth.mode = 'authenticated'
    const router = createMemoryRouter(
      [
        { path: '/', element: <WelcomeScreen /> },
        { path: '/home', element: <p>home page</p> },
      ],
      { initialEntries: ['/'] },
    )
    const view = render(<RouterProvider router={router} />)
    expect(router.state.location.pathname).toBe('/')
    h.auth.loading = false
    view.rerender(<RouterProvider key="after-loading" router={router} />)
    await waitFor(() => expect(router.state.location.pathname).toBe('/home'))
  })
})

describe('a guest and a visitor with no identity', () => {
  it('a guest stays on the welcome screen until they press a button', async () => {
    h.auth.mode = 'guest'
    const router = renderAt()
    await new Promise((r) => setTimeout(r, 30))
    expect(router.state.location.pathname).toBe('/')
    expect(screen.getByRole('button', { name: 'Play as guest' })).toBeInTheDocument()
  })

  it('a visitor with no identity stays too', async () => {
    const router = renderAt()
    await new Promise((r) => setTimeout(r, 30))
    expect(router.state.location.pathname).toBe('/')
  })
})

describe('the buttons', () => {
  it('Continue with Google signs in, then goes to /home', async () => {
    const router = renderAt()
    await userEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))
    expect(h.auth.signInWithGoogle).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(router.state.location.pathname).toBe('/home'))
  })

  it('Continue with Google goes to state.from when there is one', async () => {
    const router = renderAt({ pathname: '/', state: { from: '/game/ABC234' } })
    await userEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/game/ABC234'))
  })

  it('does not navigate when the sign-in fails (a closed popup)', async () => {
    h.auth.signInWithGoogle.mockRejectedValue(new Error('auth/popup-closed-by-user'))
    const router = renderAt()
    await userEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))
    await new Promise((r) => setTimeout(r, 30))
    expect(h.auth.signInWithGoogle).toHaveBeenCalledTimes(1)
    expect(router.state.location.pathname).toBe('/')
  })

  it('Play as guest continues as a guest, then goes to /home', async () => {
    const router = renderAt()
    await userEvent.click(screen.getByRole('button', { name: 'Play as guest' }))
    expect(h.auth.continueAsGuest).toHaveBeenCalledTimes(1)
    expect(h.auth.signInWithGoogle).not.toHaveBeenCalled()
    await waitFor(() => expect(router.state.location.pathname).toBe('/home'))
  })

  it('Play as guest goes to state.from when there is one', async () => {
    const router = renderAt({ pathname: '/', state: { from: '/game/ABC234' } })
    await userEvent.click(screen.getByRole('button', { name: 'Play as guest' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/game/ABC234'))
  })
})

describe('a failed Google sign-in (section 3.4)', () => {
  const press = () => userEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))

  it('shows a danger alert under the buttons with the fallback copy', async () => {
    h.auth.signInWithGoogle.mockRejectedValue(new Error('boom'))
    const router = renderAt()
    await press()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign in with Google. Try again.')
    expect(router.state.location.pathname).toBe('/')
  })

  it('shows a string detail from the error when there is one', async () => {
    h.auth.signInWithGoogle.mockRejectedValue({ response: { data: { detail: 'Sign-in is closed.' } } })
    renderAt()
    await press()
    expect(await screen.findByText('Sign-in is closed.')).toBeInTheDocument()
  })

  it.each(['auth/popup-closed-by-user', 'auth/cancelled-popup-request'])('shows nothing when the popup was closed (%s)', async (code) => {
    h.auth.signInWithGoogle.mockRejectedValue(Object.assign(new Error('closed'), { code }))
    renderAt()
    await press()
    await waitFor(() => expect(h.auth.signInWithGoogle).toHaveBeenCalledTimes(1))
    await new Promise((r) => setTimeout(r, 30))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('clears the alert on the next press', async () => {
    h.auth.signInWithGoogle.mockRejectedValueOnce(new Error('boom'))
    h.auth.signInWithGoogle.mockImplementationOnce(() => new Promise(() => {}))
    renderAt()
    await press()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await press()
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('a closed popup after an earlier failure clears the earlier alert', async () => {
    h.auth.signInWithGoogle.mockRejectedValueOnce(new Error('boom'))
    h.auth.signInWithGoogle.mockRejectedValueOnce(Object.assign(new Error('c'), { code: 'auth/popup-closed-by-user' }))
    renderAt()
    await press()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await press()
    await waitFor(() => expect(h.auth.signInWithGoogle).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })
})
