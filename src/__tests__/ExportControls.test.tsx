/**
 * Section 29 - ExportControls (spec 13.8 block 6 "Export", spec 13.4 export route).
 * The export is open by game id: no host secret, every viewer; each format downloads once
 * per browser session (UX only, the server's per-IP limit is the real guard).
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase', () => ({ auth: { currentUser: null }, googleProvider: {}, app: {} }))

import { tooManyRequestsMessage } from '../api/friendlyErrors'
import ExportControls from '../components/results/ExportControls'
import { INITIAL_STATE, useGameStore } from '../store/gameStore'
import { clearPulkyStorage } from '../utils/storage'
import { header, mockHttp, urlPath, verb, type HttpSpy } from './fixtures/resultsHelpers'

const NOTE = "Anyone who can see these results can download the game's data, each format once per browser session."
const CSV_DONE = 'CSV already downloaded this session'
const JSON_DONE = 'JSON already downloaded this session'

let spy: HttpSpy
let clicked: Array<{ download: string; href: string }>
const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:pulky-1')
const revokeObjectURL = vi.fn()

beforeEach(() => {
  window.sessionStorage.clear()
  useGameStore.setState({ ...INITIAL_STATE })
  clicked = []
  createObjectURL.mockClear()
  URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL
  URL.revokeObjectURL = revokeObjectURL
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push({ download: this.download, href: this.href })
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  spy?.restore()
})

function show(gameId = '9f2c1a0b77') {
  return render(<ExportControls gameId={gameId} roomCode="ABC234" />)
}

/** The message is either on screen or raised as an error alert in the store. */
function raisedError(message: string): boolean {
  return (
    screen.queryByText(message) !== null ||
    useGameStore.getState().alerts.some((a) => a.kind === 'error' && a.message === message)
  )
}

describe('the controls', () => {
  it('has Export CSV, Export JSON and the 24-hour note', () => {
    show()
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export JSON' })).toBeInTheDocument()
    expect(screen.getByText(NOTE)).toBeInTheDocument()
  })
})

describe('downloading', () => {
  it('Export CSV requests the game by id with no host secret and saves pulky-ABC234-9f2c1a0b.csv through an object URL', async () => {
    spy = mockHttp(() => ({ status: 200, data: new Blob(['a,b\n1,2'], { type: 'text/csv' }) }))
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    await waitFor(() => expect(clicked).toHaveLength(1))

    expect(spy.seen).toHaveLength(1)
    expect(verb(spy.seen[0])).toBe('GET')
    expect(urlPath(spy.seen[0])).toBe('games/id/9f2c1a0b77/export')
    expect((spy.seen[0].params as Record<string, unknown>).format).toBe('csv')
    expect(header(spy.seen[0], 'X-Host-Secret')).toBeUndefined()

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob)
    expect(clicked[0].download).toBe('pulky-ABC234-9f2c1a0b.csv')
    expect(clicked[0].href).toBe('blob:pulky-1')
  })

  it('Export JSON requests format=json and saves pulky-ABC234-9f2c1a0b.json', async () => {
    spy = mockHttp(() => ({ status: 200, data: new Blob(['{}'], { type: 'application/json' }) }))
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Export JSON' }))
    await waitFor(() => expect(clicked).toHaveLength(1))
    expect((spy.seen[0].params as Record<string, unknown>).format).toBe('json')
    expect(clicked[0].download).toBe('pulky-ABC234-9f2c1a0b.json')
  })

  it('downloads nothing and shows no error while nothing was pressed', () => {
    spy = mockHttp(() => ({ status: 200, data: new Blob(['x']) }))
    show()
    expect(spy.seen).toHaveLength(0)
    expect(clicked).toHaveLength(0)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('once per browser session (UX only)', () => {
  it('after a download that format is disabled and says so; the other stays available', async () => {
    spy = mockHttp(() => ({ status: 200, data: new Blob(['x']) }))
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    const done = await screen.findByRole('button', { name: CSV_DONE })
    expect(done).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Export JSON' })).toBeEnabled()
    await userEvent.click(done)
    expect(spy.seen).toHaveLength(1)
    expect(window.sessionStorage.getItem('pulky.exported.9f2c1a0b77.csv')).toBe('1')
    expect(window.sessionStorage.getItem('pulky.exported.9f2c1a0b77.json')).toBeNull()
  })

  it('remembers the download across a remount in the same session, per game', async () => {
    spy = mockHttp(() => ({ status: 200, data: new Blob(['x']) }))
    const first = show()
    await userEvent.click(screen.getByRole('button', { name: 'Export JSON' }))
    await screen.findByRole('button', { name: JSON_DONE })
    first.unmount()
    const second = show()
    expect(screen.getByRole('button', { name: JSON_DONE })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled()
    second.unmount()
    show('0000aaaa11')
    expect(screen.getByRole('button', { name: 'Export JSON' })).toBeEnabled()
  })

  it("sign-out's sweep of pulky.* keys clears the flag", async () => {
    spy = mockHttp(() => ({ status: 200, data: new Blob(['x']) }))
    const view = show()
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    await screen.findByRole('button', { name: CSV_DONE })
    view.unmount()
    clearPulkyStorage()
    show()
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled()
  })

  it('a failed download is not remembered', async () => {
    spy = mockHttp(() => ({ status: 500, data: {} }))
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    await waitFor(() => expect(raisedError('Export failed. Try again.')).toBe(true))
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled()
    expect(window.sessionStorage.getItem('pulky.exported.9f2c1a0b77.csv')).toBeNull()
  })
})

describe('failures', () => {
  it('a 429 reads as the friendly rate-limit message, saves nothing and stays available', async () => {
    spy = mockHttp(() => ({ status: 429, data: { detail: 'Too many requests. Wait a minute and try again.' } }))
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    await waitFor(() => expect(raisedError(tooManyRequestsMessage(undefined))).toBe(true))
    expect(clicked).toHaveLength(0)
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled()
  })

  it('another failure with no server message says Export failed. Try again.', async () => {
    spy = mockHttp(() => ({ status: 500, data: {} }))
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    await waitFor(() => expect(raisedError('Export failed. Try again.')).toBe(true))
    expect(clicked).toHaveLength(0)
  })

  it('an unknown game (404) shows the server message (errorMessage)', async () => {
    spy = mockHttp(() => ({ status: 404, data: { detail: 'Results not found.' } }))
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    await waitFor(() => expect(raisedError('Results not found.')).toBe(true))
  })
})
