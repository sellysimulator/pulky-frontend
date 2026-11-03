/**
 * Spec §13.6: the backend's hard limits are read from `GET /config/defaults` into the
 * store, never copied into the client. REST goes through the `http` instance's adapter
 * (section 21, 3.3a).
 */
import { render } from '@testing-library/react'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const backend = vi.hoisted(() => ({ status: 'awake' as string }))
vi.mock('../contexts/BackendStatusContext', () => ({
  useBackendStatus: () => ({ status: backend.status, elapsedSeconds: 0, httpStatus: null, retry: async () => undefined }),
}))

import { loadLimits, useLimits } from '../api/config'
import http from '../api/http'
import { RequireBackend } from '../routes/guards'
import { INITIAL_STATE, useGameStore } from '../store/gameStore'
import { DEFAULTS_RESPONSE, SERVER_LIMITS } from './fixtures/serverConfig'

let calls: string[] = []
let fail = false
const original = http.defaults.adapter

function settle(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0))
}

beforeEach(() => {
  useGameStore.setState({ ...INITIAL_STATE })
  calls = []
  fail = false
  backend.status = 'awake'
  const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
    calls.push(`${config.method?.toUpperCase()} ${config.url}`)
    if (fail) throw new Error('offline')
    return { data: structuredClone(DEFAULTS_RESPONSE), status: 200, statusText: 'OK', headers: {}, config }
  }
  http.defaults.adapter = adapter
})

afterEach(() => {
  http.defaults.adapter = original
})

describe('loadLimits', () => {
  it("stores the server's limits from GET /config/defaults", async () => {
    await loadLimits()
    expect(calls).toEqual(['GET /config/defaults'])
    expect(useGameStore.getState().limits).toEqual(SERVER_LIMITS)
  })

  it('makes one request for concurrent calls and none once the limits are held', async () => {
    await Promise.all([loadLimits(), loadLimits(), loadLimits()])
    await loadLimits()
    expect(calls).toHaveLength(1)
  })

  it('leaves the limits null after a failure, and tries again on the next call', async () => {
    fail = true
    await loadLimits()
    expect(useGameStore.getState().limits).toBeNull()
    fail = false
    await loadLimits()
    expect(calls).toHaveLength(2)
    expect(useGameStore.getState().limits).toEqual(SERVER_LIMITS)
  })
})

function Reader(): React.ReactElement {
  const limits = useLimits()
  return <p>{limits === null ? 'none' : String(limits.MAX_ORDER)}</p>
}

describe('who loads them', () => {
  it('RequireBackend loads them once the backend is awake', async () => {
    render(
      <MemoryRouter>
        <RequireBackend>
          <Reader />
        </RequireBackend>
      </MemoryRouter>,
    )
    await settle()
    expect(calls).toEqual(['GET /config/defaults'])
    expect(useGameStore.getState().limits).toEqual(SERVER_LIMITS)
  })

  it('RequireBackend requests nothing while the backend is still waking', async () => {
    backend.status = 'waking'
    render(
      <MemoryRouter>
        <RequireBackend>
          <Reader />
        </RequireBackend>
      </MemoryRouter>,
    )
    await settle()
    expect(calls).toEqual([])
  })

  it('useLimits only reads the store: mounting a reader requests nothing', async () => {
    const { getByText } = render(<Reader />)
    await settle()
    expect(getByText('none')).toBeInTheDocument()
    expect(calls).toEqual([])
  })
})
