import { render, screen } from '@testing-library/react'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createMemoryRouter, MemoryRouter, RouterProvider, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

const h = vi.hoisted(() => ({
  auth: { loading: false, mode: null as 'authenticated' | 'guest' | null },
  backend: { status: 'awake' as 'checking' | 'awake' | 'waking', elapsedSeconds: 0 },
}))

vi.mock('../../firebase', () => ({ auth: { currentUser: null }, googleProvider: {}, app: {} }))

vi.mock('socket.io-client', () => ({
  io: () => {
    const fake = {
      connected: false,
      on: () => fake,
      off: () => fake,
      emit: () => fake,
      connect: () => fake,
      disconnect: () => fake,
      listeners: () => [],
    }
    return fake
  },
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    loading: h.auth.loading,
    mode: h.auth.mode,
    user: null,
    signInWithGoogle: async () => undefined,
    continueAsGuest: () => undefined,
    signOut: async () => undefined,
  }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('../contexts/BackendStatusContext', () => ({
  useBackendStatus: () => h.backend,
  BackendStatusProvider: ({ children }: { children: ReactNode }) => children,
}))

import App from '../App'
import { RequireAuth, RequireBackend } from '../routes/guards'
import { getRoutes as getRegistryRoutes, getShellComponent as getRegistryShell } from '../routes/registry'

beforeEach(() => {
  h.auth.loading = false
  h.auth.mode = null
  h.backend.status = 'awake'
  h.backend.elapsedSeconds = 0
})

const shellExists = (name: string) =>
  existsSync(resolve(process.cwd(), 'src/components/shared', `${name}.tsx`))

function Where() {
  const location = useLocation()
  const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from
  return (
    <p data-testid="where">
      {location.pathname}|{from?.pathname ?? 'no-from'}|{from?.search ?? ''}
    </p>
  )
}

describe('the registry', () => {
  it('getRoutes returns well-formed descriptors with a component each', () => {
    const routes = getRegistryRoutes()
    expect(Array.isArray(routes)).toBe(true)
    for (const r of routes) {
      expect(typeof r.path).toBe('string')
      expect(r.path.startsWith('/')).toBe(true)
      expect(['public', 'auth', 'auth+backend']).toContain(r.guard)
      expect(r.component).toBeTruthy()
    }
  })

  it.each(['BackendWakeUp', 'AlertContainer', 'LoadingSpinner'] as const)(
    'getShellComponent(%s) is null exactly while src/components/shared/%s.tsx does not exist',
    (name) => {
      const found = getRegistryShell(name)
      if (shellExists(name)) expect(found).not.toBeNull()
      else expect(found).toBeNull()
    },
  )
})

describe('RequireAuth (criterion 10)', () => {
  function renderAt(url: string) {
    const router = createMemoryRouter(
      [
        {
          path: '/home/:id',
          element: (
            <RequireAuth>
              <p>secret page</p>
            </RequireAuth>
          ),
        },
        { path: '/', element: <Where /> },
      ],
      { initialEntries: [url] },
    )
    render(<RouterProvider router={router} />)
    return router
  }

  it('while loading, shows the checking-your-sign-in status and no children', () => {
    h.auth.loading = true
    renderAt('/home/1')
    expect(screen.getByText(/Checking your sign-in/)).toBeInTheDocument()
    expect(screen.queryByText('secret page')).not.toBeInTheDocument()
  })

  it('does not redirect while loading, even though mode is still null', () => {
    h.auth.loading = true
    const router = renderAt('/home/1')
    expect(router.state.location.pathname).toBe('/home/1')
  })

  it('redirects an unauthenticated visitor to / with state.from set, replacing the history entry', () => {
    const router = renderAt('/home/42?invite=1')
    expect(screen.queryByText('secret page')).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(router.state.historyAction).toBe('REPLACE')
    expect(screen.getByTestId('where').textContent).toBe('/|/home/42|?invite=1')
  })

  it.each(['authenticated', 'guest'] as const)('renders the children in %s mode', (mode) => {
    h.auth.mode = mode
    const router = renderAt('/home/1')
    expect(screen.getByText('secret page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/home/1')
  })
})

describe('RequireBackend (criterion 10)', () => {
  const tree = (
    <MemoryRouter>
      <RequireBackend>
        <p>backend page</p>
      </RequireBackend>
    </MemoryRouter>
  )

  it('renders the children once the backend is awake', () => {
    h.backend.status = 'awake'
    render(tree)
    expect(screen.getByText('backend page')).toBeInTheDocument()
  })

  it.each(['checking', 'waking'] as const)('withholds the children while the backend is %s', (status) => {
    h.backend.status = status
    const { container } = render(tree)
    expect(screen.queryByText('backend page')).not.toBeInTheDocument()
    expect(container.textContent?.length ?? 0).toBeGreaterThan(0)
    if (!shellExists('BackendWakeUp')) {
      expect(screen.getByRole('status')).toHaveTextContent('Waking up the game server')
    }
  })

  it('shows the fallback status for the loading guard when the LoadingSpinner shell does not exist yet', () => {
    if (shellExists('LoadingSpinner')) return
    h.auth.loading = true
    render(
      <MemoryRouter>
        <RequireAuth>
          <p>secret page</p>
        </RequireAuth>
      </MemoryRouter>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Checking your sign-in')
  })
})

describe('App', () => {
  it('sends an unknown path to /', () => {
    render(
      <MemoryRouter initialEntries={['/definitely/not/a/route']}>
        <App />
        <Where />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('where').textContent?.startsWith('/|')).toBe(true)
  })

  it('renders at / without crashing', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    expect(container).toBeTruthy()
  })
})
