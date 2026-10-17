import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase', () => ({ auth: { currentUser: null }, googleProvider: {}, app: {} }))

import { probeHealth } from '../api/health'
import { BackendStatusProvider, useBackendStatus } from '../contexts/BackendStatusContext'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const html = () =>
  new Response('<!doctype html><html><body>app</body></html>', {
    status: 200,
    headers: { 'content-type': 'text/html' },
  })

let fetchMock: ReturnType<typeof vi.fn>

function stubFetch(impl: (url: string, init?: RequestInit) => Promise<Response>): void {
  fetchMock = vi.fn(impl)
  vi.stubGlobal('fetch', fetchMock)
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const OK = { outcome: 'ok' }
const NO_ANSWER = { outcome: 'no-answer' }

describe('probeHealth (spec 13.6, criterion 9)', () => {
  it('is ok for a 200 JSON body whose status is exactly "ok"', async () => {
    stubFetch(async () => json({ status: 'ok' }))
    await expect(probeHealth()).resolves.toEqual(OK)
  })

  it('is ok when the body has extra keys', async () => {
    stubFetch(async () => json({ status: 'ok', version: '1' }))
    await expect(probeHealth()).resolves.toEqual(OK)
  })

  it('failure mode 8: a 200 text/html response (the Hosting SPA rewrite) is no answer', async () => {
    stubFetch(async () => html())
    await expect(probeHealth()).resolves.toEqual(NO_ANSWER)
  })

  it.each([
    ['{"status":"healthy"}', { status: 'healthy' }],
    ['{"status":"OK"}', { status: 'OK' }],
    ['{"status":true}', { status: true }],
    ['{"status":["ok"]}', { status: ['ok'] }],
    ['{}', {}],
    ['null', null],
    ['an array', ['ok']],
    ['a bare string', 'ok'],
  ])('is no answer for a 200 body of %s', async (_label, body) => {
    stubFetch(async () => json(body))
    await expect(probeHealth()).resolves.toEqual(NO_ANSWER)
  })

  it.each([500, 502, 503, 504, 408, 429])('is no answer for a %i, even with a good body (a cold start or a busy server)', async (code) => {
    stubFetch(async () => json({ status: 'ok' }, code))
    await expect(probeHealth()).resolves.toEqual(NO_ANSWER)
  })

  it.each([400, 401, 403, 404, 405])('is rejected with the status for a %i, even with a good body', async (code) => {
    stubFetch(async () => json({ status: 'ok' }, code))
    await expect(probeHealth()).resolves.toEqual({ outcome: 'rejected', httpStatus: code })
  })

  it('never rejects: a rejected fetch resolves no answer', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(probeHealth()).resolves.toEqual(NO_ANSWER)
  })

  it('calls the global fetch on /api/v1/health, with the base URL prefix from VITE_API_BASE_URL', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    vi.resetModules()
    stubFetch(async () => json({ status: 'ok' }))
    let mod = await import('../api/health')
    await mod.probeHealth()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/health')

    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test')
    vi.resetModules()
    stubFetch(async () => json({ status: 'ok' }))
    mod = await import('../api/health')
    await mod.probeHealth()
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.test/api/v1/health')
  })

  it('passes an AbortSignal and aborts after timeoutMs, resolving no answer', async () => {
    vi.useFakeTimers()
    stubFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )
    const settled = vi.fn()
    const promise = probeHealth(200).then((v) => {
      settled(v)
      return v
    })
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal)
    await vi.advanceTimersByTimeAsync(199)
    expect(settled).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await expect(promise).resolves.toEqual(NO_ANSWER)
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true)
  })

  it('defaults the timeout to 5000 ms', async () => {
    vi.useFakeTimers()
    stubFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )
    const settled = vi.fn()
    const promise = probeHealth().then((v) => {
      settled(v)
      return v
    })
    await vi.advanceTimersByTimeAsync(4999)
    expect(settled).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await expect(promise).resolves.toEqual(NO_ANSWER)
  })
})

describe('BackendStatusProvider (spec 3.5)', () => {
  let latest: ReturnType<typeof useBackendStatus>

  function Probe() {
    latest = useBackendStatus()
    const { status, elapsedSeconds, httpStatus } = latest
    return (
      <p role="status">
        {status}|{elapsedSeconds}|{httpStatus ?? 'none'}
      </p>
    )
  }

  const read = () => {
    const [status, elapsed, httpStatus] = (screen.getByRole('status').textContent ?? '').split('|')
    return { status, elapsed: Number(elapsed), httpStatus }
  }

  const advance = (ms: number) => act(async () => vi.advanceTimersByTimeAsync(ms))

  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('is "checking" until the first answer arrives', async () => {
    stubFetch(() => new Promise<Response>(() => {}))
    render(
      <BackendStatusProvider>
        <Probe />
      </BackendStatusProvider>,
    )
    await advance(10)
    expect(read().status).toBe('checking')
  })

  it('goes straight to "awake" on a true first probe and stops polling for good', async () => {
    stubFetch(async () => json({ status: 'ok' }))
    render(
      <BackendStatusProvider pollMs={100}>
        <Probe />
      </BackendStatusProvider>,
    )
    await advance(10)
    expect(read().status).toBe('awake')
    const calls = fetchMock.mock.calls.length
    expect(calls).toBe(1)
    await advance(2000)
    expect(fetchMock.mock.calls.length).toBe(calls)
    expect(read().status).toBe('awake')
  })

  it('is "waking" on a false answer, retries every pollMs and becomes "awake" when the backend answers', async () => {
    let healthy = false
    stubFetch(async () => (healthy ? json({ status: 'ok' }) : html()))
    render(
      <BackendStatusProvider pollMs={1000}>
        <Probe />
      </BackendStatusProvider>,
    )
    await advance(10)
    expect(read().status).toBe('waking')
    expect(fetchMock.mock.calls.length).toBe(1)
    await advance(1000)
    expect(fetchMock.mock.calls.length).toBe(2)
    await advance(1000)
    expect(fetchMock.mock.calls.length).toBe(3)
    expect(read().status).toBe('waking')
    healthy = true
    await advance(1000)
    expect(read().status).toBe('awake')
    const calls = fetchMock.mock.calls.length
    healthy = false
    await advance(5000)
    expect(fetchMock.mock.calls.length).toBe(calls)
    expect(read().status).toBe('awake')
  })

  it('polls every 3000 ms by default', async () => {
    stubFetch(async () => json({ status: 'starting' }))
    render(
      <BackendStatusProvider>
        <Probe />
      </BackendStatusProvider>,
    )
    await advance(100)
    expect(fetchMock.mock.calls.length).toBe(1)
    await advance(2800)
    expect(fetchMock.mock.calls.length).toBe(1)
    await advance(300)
    expect(fetchMock.mock.calls.length).toBe(2)
  })

  it('counts elapsedSeconds from mount while the backend is not awake', async () => {
    stubFetch(async () => json({ status: 'starting' }, 503))
    render(
      <BackendStatusProvider pollMs={1000}>
        <Probe />
      </BackendStatusProvider>,
    )
    await advance(500)
    expect(read().elapsed).toBe(0)
    await advance(9500)
    expect(read().status).toBe('waking')
    expect(read().elapsed).toBeGreaterThanOrEqual(9)
    expect(read().elapsed).toBeLessThanOrEqual(10)
  })

  it('is "unreachable" once there has been no answer for wakeWindowMs, keeps polling and recovers', async () => {
    let healthy = false
    stubFetch(async () => (healthy ? json({ status: 'ok' }) : json({}, 503)))
    render(
      <BackendStatusProvider pollMs={1000} wakeWindowMs={5000}>
        <Probe />
      </BackendStatusProvider>,
    )
    await advance(10)
    expect(read().status).toBe('waking')
    await advance(3000)
    expect(read().status).toBe('waking')
    await advance(3000)
    expect(read().status).toBe('unreachable')
    const calls = fetchMock.mock.calls.length
    await advance(2000)
    expect(fetchMock.mock.calls.length).toBe(calls + 2)
    healthy = true
    await advance(1000)
    expect(read().status).toBe('awake')
  })

  it('is "rejected" with the HTTP status on a 4xx, keeps polling, and clears the status on a later answer', async () => {
    let code = 404
    stubFetch(async () => json(code === 200 ? { status: 'ok' } : { detail: 'Not Found' }, code))
    render(
      <BackendStatusProvider pollMs={1000}>
        <Probe />
      </BackendStatusProvider>,
    )
    await advance(10)
    expect(read()).toMatchObject({ status: 'rejected', httpStatus: '404' })
    code = 503
    await advance(1000)
    expect(fetchMock.mock.calls.length).toBe(2)
    expect(read()).toMatchObject({ status: 'waking', httpStatus: 'none' })
    code = 200
    await advance(1000)
    expect(read().status).toBe('awake')
  })

  it('is "offline" while the browser reports no network; coming back probes at once and restarts the allowance', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    render(
      <BackendStatusProvider pollMs={60_000} wakeWindowMs={5000}>
        <Probe />
      </BackendStatusProvider>,
    )
    await advance(10)
    expect(read().status).toBe('offline')
    await advance(9000)
    expect(read().elapsed).toBe(9)
    onLine.mockReturnValue(true)
    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await vi.advanceTimersByTimeAsync(10)
    })
    expect(fetchMock.mock.calls.length).toBe(2)
    // Past wakeWindowMs since mount, but the server was never asked while offline.
    expect(read()).toMatchObject({ status: 'waking', elapsed: 0 })
  })

  it('retry probes at once instead of at the next poll, and resolves once that probe has answered', async () => {
    let code = 404
    stubFetch(async () => json(code === 200 ? { status: 'ok' } : {}, code))
    render(
      <BackendStatusProvider pollMs={60_000}>
        <Probe />
      </BackendStatusProvider>,
    )
    await advance(10)
    expect(read().status).toBe('rejected')
    code = 200
    let resolved = false
    await act(async () => {
      void latest.retry().then(() => {
        resolved = true
      })
      await vi.advanceTimersByTimeAsync(10)
    })
    expect(fetchMock.mock.calls.length).toBe(2)
    expect(resolved).toBe(true)
    expect(read().status).toBe('awake')
  })

  it('retry joins a probe already in flight instead of starting a second one', async () => {
    let answer: (res: Response) => void = () => undefined
    stubFetch(() => new Promise<Response>((resolve) => (answer = resolve)))
    render(
      <BackendStatusProvider pollMs={60_000}>
        <Probe />
      </BackendStatusProvider>,
    )
    await advance(10)
    await act(async () => {
      void latest.retry()
      void latest.retry()
    })
    expect(fetchMock.mock.calls.length).toBe(1)
    answer(json({ status: 'ok' }))
    await advance(10)
    expect(read().status).toBe('awake')
  })
})
