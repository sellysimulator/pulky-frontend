import { act, renderHook, waitFor } from '@testing-library/react'
import type { InternalAxiosRequestConfig } from 'axios'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Listener = (...args: unknown[]) => void
type AuthCallback = (user: unknown) => void

const h = vi.hoisted(() => {
  const lifecycle: string[] = []
  const state: {
    currentUser: unknown
    authCb: ((user: unknown) => void) | null
    unsubscribed: number
    signInWithPopup: ((...args: unknown[]) => Promise<unknown>) | null
    signOutCalls: unknown[][]
  } = { currentUser: null, authCb: null, unsubscribed: 0, signInWithPopup: null, signOutCalls: [] }
  const popupCalls: unknown[][] = []
  const authObject = {
    get currentUser() {
      return state.currentUser
    },
  }
  const fake = {
    connected: false,
    on() {
      return fake
    },
    off() {
      return fake
    },
    emit() {
      return fake
    },
    connect() {
      lifecycle.push('connect')
      return fake
    },
    disconnect() {
      lifecycle.push('disconnect')
      return fake
    },
    listeners(): Listener[] {
      return []
    },
  }
  const resolver = { name: 'browserPopupRedirectResolver' }
  const provider = { name: 'googleProvider' }
  return { lifecycle, state, popupCalls, authObject, fake, resolver, provider }
})

vi.mock('socket.io-client', () => ({ io: () => h.fake }))

vi.mock('../../firebase', () => ({ auth: h.authObject, googleProvider: h.provider, app: {} }))

vi.mock('firebase/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('firebase/auth')>()),
  browserPopupRedirectResolver: h.resolver,
  onAuthStateChanged: (_auth: unknown, cb: AuthCallback) => {
    h.state.authCb = cb
    return () => {
      h.state.unsubscribed += 1
    }
  },
  signInWithPopup: (...args: unknown[]) => {
    h.popupCalls.push(args)
    return h.state.signInWithPopup ? h.state.signInWithPopup(...args) : Promise.resolve({ user: null })
  },
  signOut: (...args: unknown[]) => {
    h.state.signOutCalls.push(args)
    return Promise.resolve()
  },
}))

import http from '../api/http'
import { AuthProvider, useAuth } from '../auth/AuthContext'
import { BackendStatusProvider } from '../contexts/BackendStatusContext'
import mainSource from '../main.tsx?raw'
import { useGameStore, INITIAL_STATE } from '../store/gameStore'
import { getGuestMode } from '../utils/storage'

const originalAdapter = http.defaults.adapter
let requests: InternalAxiosRequestConfig[] = []
let upsertStatus = 200

function upsertRequests(): InternalAxiosRequestConfig[] {
  return requests.filter((r) => (r.url ?? '').replace(/^\/+/, '') === 'users/upsert')
}

beforeEach(() => {
  h.lifecycle.length = 0
  h.popupCalls.length = 0
  h.state.currentUser = null
  h.state.authCb = null
  h.state.unsubscribed = 0
  h.state.signInWithPopup = null
  h.state.signOutCalls = []
  requests = []
  upsertStatus = 200
  useGameStore.setState(structuredClone(INITIAL_STATE))
  http.defaults.adapter = async (config) => {
    requests.push(config)
    if (upsertStatus >= 400) {
      const err = Object.assign(new Error('request failed'), {
        isAxiosError: true,
        config,
        response: { status: upsertStatus, data: { detail: 'Sign-in is not available right now.' }, headers: {}, statusText: 'x', config },
      })
      throw err
    }
    return { data: { display_name: 'Ana', email: null, photo_url: null }, status: 200, statusText: 'OK', headers: {}, config }
  }
})

afterEach(() => {
  http.defaults.adapter = originalAdapter
  vi.unstubAllGlobals()
})

const user = (extra: object = {}) => ({
  displayName: 'Ana Pulquera',
  email: 'ana@example.test',
  photoURL: 'https://example.test/a.png',
  uid: 'firebase-uid-should-not-leak',
  getIdToken: async () => 'tok',
  ...extra,
})

function healthResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <BackendStatusProvider pollMs={20}>
      <AuthProvider>{children}</AuthProvider>
    </BackendStatusProvider>
  )
}

/** Lets the health probe's promise chain settle. */
async function settle() {
  await act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve()
  })
}

function mount() {
  return renderHook(() => useAuth(), { wrapper: Providers })
}

/** Mounts against an awake backend: the probe has answered ok before the test acts. */
async function mountAwake() {
  vi.stubGlobal('fetch', vi.fn(async () => healthResponse({ status: 'ok' })))
  const mounted = mount()
  await settle()
  return mounted
}

describe('AuthProvider state', () => {
  it('is loading, with no mode and no user, until the first onAuthStateChanged', () => {
    const { result } = mount()
    expect(result.current.loading).toBe(true)
    expect(result.current.mode).toBeNull()
    expect(result.current.user).toBeNull()
  })

  it('does not connect the socket before auth resolves (failure mode 9)', () => {
    mount()
    expect(h.lifecycle).not.toContain('connect')
  })

  it('resolves signed out: not loading, mode null, and reconnects the socket', async () => {
    const { result } = await mountAwake()
    act(() => h.state.authCb?.(null))
    expect(result.current.loading).toBe(false)
    expect(result.current.mode).toBeNull()
    expect(result.current.user).toBeNull()
    expect(h.lifecycle).toEqual(['disconnect', 'connect'])
  })

  it('resolves signed in: authenticated, with the three profile fields and nothing else', async () => {
    const { result } = await mountAwake()
    act(() => h.state.authCb?.(user()))
    expect(result.current.loading).toBe(false)
    expect(result.current.mode).toBe('authenticated')
    expect(result.current.user).toEqual({
      displayName: 'Ana Pulquera',
      email: 'ana@example.test',
      photoURL: 'https://example.test/a.png',
    })
    expect(h.lifecycle).toEqual(['disconnect', 'connect'])
  })

  it('calls socket.disconnect().connect() on every later resolution too (identity changed)', async () => {
    const { result } = await mountAwake()
    act(() => h.state.authCb?.(null))
    act(() => h.state.authCb?.(user()))
    expect(h.lifecycle).toEqual(['disconnect', 'connect', 'disconnect', 'connect'])
    act(() => h.state.authCb?.(null))
    expect(h.lifecycle).toEqual(['disconnect', 'connect', 'disconnect', 'connect', 'disconnect', 'connect'])
    expect(result.current.mode).toBeNull()
  })

  it('signing in does not by itself call upsert on an auth state change', () => {
    mount()
    act(() => h.state.authCb?.(user()))
    expect(upsertRequests()).toHaveLength(0)
  })

  it('unsubscribes from auth state on unmount', () => {
    const { unmount } = mount()
    unmount()
    expect(h.state.unsubscribed).toBeGreaterThanOrEqual(1)
  })
})

describe('continueAsGuest', () => {
  it('switches to guest mode, remembers it and reconnects the socket, without a Firebase event', async () => {
    const { result } = await mountAwake()
    act(() => h.state.authCb?.(null))
    h.lifecycle.length = 0
    act(() => result.current.continueAsGuest())
    expect(result.current.mode).toBe('guest')
    expect(result.current.user).toBeNull()
    expect(getGuestMode()).toBe(true)
    expect(h.lifecycle).toEqual(['disconnect', 'connect'])
  })
})

describe('socket connect waits for the awake backend (failure mode 16)', () => {
  const alerts = () => useGameStore.getState().alerts

  it('while the backend is waking, an auth resolution makes no connect and raises no alert; the first awake connects once', async () => {
    let answer: unknown = null
    vi.stubGlobal('fetch', vi.fn(async () => (answer ? healthResponse(answer) : Promise.reject(new TypeError('network')))))
    mount()
    await settle()
    act(() => h.state.authCb?.(user()))
    await settle()
    expect(h.lifecycle).toEqual([])
    expect(alerts()).toHaveLength(0)

    answer = { status: 'ok' }
    await waitFor(() => expect(h.lifecycle).toEqual(['disconnect', 'connect']))
    await settle()
    expect(h.lifecycle).toEqual(['disconnect', 'connect'])
  })

  it('continueAsGuest() while waking waits too, and several early triggers still connect once on awake', async () => {
    let answer: unknown = null
    vi.stubGlobal('fetch', vi.fn(async () => (answer ? healthResponse(answer) : Promise.reject(new TypeError('network')))))
    const { result } = mount()
    await settle()
    act(() => h.state.authCb?.(null))
    act(() => result.current.continueAsGuest())
    await settle()
    expect(h.lifecycle).toEqual([])

    answer = { status: 'ok' }
    await waitFor(() => expect(h.lifecycle).toContain('connect'))
    await settle()
    expect(h.lifecycle).toEqual(['disconnect', 'connect'])
  })

  it('once awake, a later continueAsGuest() reconnects once more, and a plain re-render adds nothing', async () => {
    const { result, rerender } = await mountAwake()
    expect(h.lifecycle).toEqual([])
    act(() => h.state.authCb?.(null))
    expect(h.lifecycle).toEqual(['disconnect', 'connect'])
    act(() => result.current.continueAsGuest())
    expect(h.lifecycle).toEqual(['disconnect', 'connect', 'disconnect', 'connect'])
    rerender()
    expect(h.lifecycle).toHaveLength(4)
  })

  it('main.tsx renders BackendStatusProvider outside AuthProvider, after the socketHandlers import', () => {
    expect(mainSource.indexOf("import './api/socketHandlers'")).toBe(0)
    expect(mainSource.indexOf('<BackendStatusProvider>')).toBeGreaterThan(-1)
    expect(mainSource.indexOf('<BackendStatusProvider>')).toBeLessThan(mainSource.indexOf('<AuthProvider>'))
    expect(mainSource.indexOf('</AuthProvider>')).toBeLessThan(mainSource.indexOf('</BackendStatusProvider>'))
  })
})

describe('signInWithGoogle', () => {
  it('passes the popup resolver at this call, and upserts the user once with their display name', async () => {
    h.state.signInWithPopup = async () => ({ user: user() })
    const { result } = mount()
    act(() => h.state.authCb?.(null))
    await act(async () => {
      await result.current.signInWithGoogle()
    })
    expect(h.popupCalls).toHaveLength(1)
    expect(h.popupCalls[0][0]).toBe(h.authObject)
    expect(h.popupCalls[0][1]).toBe(h.provider)
    expect(h.popupCalls[0][2]).toBe(h.resolver)

    expect(upsertRequests()).toHaveLength(1)
    expect((upsertRequests()[0].method ?? '').toUpperCase()).toBe('POST')
    const sent = JSON.parse(String(upsertRequests()[0].data)) as Record<string, unknown>
    expect(sent).toEqual({ display_name: 'Ana Pulquera' })

    // the auth state change that follows a real sign-in must not upsert a second time
    act(() => h.state.authCb?.(user()))
    expect(upsertRequests()).toHaveLength(1)
  })

  it('upserts without a display_name when Google gave none', async () => {
    h.state.signInWithPopup = async () => ({ user: user({ displayName: null }) })
    const { result } = mount()
    act(() => h.state.authCb?.(null))
    await act(async () => {
      await result.current.signInWithGoogle()
    })
    expect(upsertRequests()).toHaveLength(1)
    const raw = upsertRequests()[0].data
    const sent = raw ? (JSON.parse(String(raw)) as Record<string, unknown>) : {}
    expect(sent).not.toHaveProperty('display_name')
  })

  it('a failing upsert raises an error alert and does not sign the user out', async () => {
    upsertStatus = 503
    h.state.signInWithPopup = async () => ({ user: user() })
    const { result } = mount()
    act(() => h.state.authCb?.(null))
    await act(async () => {
      await result.current.signInWithGoogle().catch(() => undefined)
    })
    expect(upsertRequests()).toHaveLength(1)
    const alerts = useGameStore.getState().alerts
    expect(alerts).toHaveLength(1)
    expect(alerts[0].kind).toBe('error')
    expect(typeof alerts[0].message).toBe('string')
    expect(alerts[0].message.length).toBeGreaterThan(0)
    expect(h.state.signOutCalls).toHaveLength(0)
  })
})

describe('signOut', () => {
  it('signs out of Firebase', async () => {
    const { result } = mount()
    act(() => h.state.authCb?.(user()))
    await act(async () => {
      await result.current.signOut()
    })
    expect(h.state.signOutCalls).toHaveLength(1)
    expect(h.state.signOutCalls[0][0]).toBe(h.authObject)
  })
})
