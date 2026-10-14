/**
 * Section 29 - ExportControls (spec 13.8 block 6 "Export", spec 13.4 export route).
 * Acceptance criterion 8 (export 403 copy).
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase', () => ({ auth: { currentUser: null }, googleProvider: {}, app: {} }))

import ExportControls from '../components/results/ExportControls'
import { INITIAL_STATE, useGameStore } from '../store/gameStore'
import { header, mockHttp, urlPath, verb, type HttpSpy } from './fixtures/resultsHelpers'

const NOTE = 'Download the data during the debrief: the room expires 24 hours after it was created.'
const FORBIDDEN = 'Only the host who created this room can export it.'

let spy: HttpSpy
let clicked: Array<{ download: string; href: string }>
const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:pulky-1')
const revokeObjectURL = vi.fn()

beforeEach(() => {
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

function show(hostSecret: string | null = 'sec-1') {
  return render(<ExportControls roomCode="ABC234" hostSecret={hostSecret} />)
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
  it('Export CSV requests format=csv with the host secret and saves pulky-ABC234.csv through an object URL', async () => {
    spy = mockHttp(() => ({ status: 200, data: new Blob(['a,b\n1,2'], { type: 'text/csv' }) }))
    show('sec-9')
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    await waitFor(() => expect(clicked).toHaveLength(1))

    expect(spy.seen).toHaveLength(1)
    expect(verb(spy.seen[0])).toBe('GET')
    expect(urlPath(spy.seen[0])).toBe('games/ABC234/export')
    expect((spy.seen[0].params as Record<string, unknown>).format).toBe('csv')
    expect(header(spy.seen[0], 'X-Host-Secret')).toBe('sec-9')

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob)
    expect(clicked[0].download).toBe('pulky-ABC234.csv')
    expect(clicked[0].href).toBe('blob:pulky-1')
  })

  it('Export JSON requests format=json and saves pulky-ABC234.json', async () => {
    spy = mockHttp(() => ({ status: 200, data: new Blob(['{}'], { type: 'application/json' }) }))
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Export JSON' }))
    await waitFor(() => expect(clicked).toHaveLength(1))
    expect((spy.seen[0].params as Record<string, unknown>).format).toBe('json')
    expect(clicked[0].download).toBe('pulky-ABC234.json')
  })

  it('without a host secret it sends no X-Host-Secret and relies on the bearer', async () => {
    spy = mockHttp(() => ({ status: 200, data: new Blob(['x']) }))
    show(null)
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    await waitFor(() => expect(spy.seen).toHaveLength(1))
    expect(header(spy.seen[0], 'X-Host-Secret')).toBeUndefined()
  })

  it('downloads nothing and shows no error while nothing was pressed', () => {
    spy = mockHttp(() => ({ status: 200, data: new Blob(['x']) }))
    show()
    expect(spy.seen).toHaveLength(0)
    expect(clicked).toHaveLength(0)
    expect(raisedError(FORBIDDEN)).toBe(false)
  })
})

describe('failures', () => {
  it('a 403 raises the spec copy, whatever the server detail says, and saves nothing', async () => {
    spy = mockHttp(() => ({ status: 403, data: { detail: 'Invalid host secret.' } }))
    show('wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    await waitFor(() => expect(raisedError(FORBIDDEN)).toBe(true))
    expect(clicked).toHaveLength(0)
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it('a 403 on Export JSON raises the same copy', async () => {
    spy = mockHttp(() => ({ status: 403, data: { detail: 'Invalid host secret.' } }))
    show('wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Export JSON' }))
    await waitFor(() => expect(raisedError(FORBIDDEN)).toBe(true))
  })

  it('another failure with no server message says Export failed. Try again.', async () => {
    spy = mockHttp(() => ({ status: 500, data: {} }))
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    await waitFor(() => expect(raisedError('Export failed. Try again.')).toBe(true))
    expect(raisedError(FORBIDDEN)).toBe(false)
    expect(clicked).toHaveLength(0)
  })

  it('another failure with a server message shows that message (errorMessage)', async () => {
    spy = mockHttp(() => ({ status: 404, data: { detail: 'Results not found.' } }))
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    await waitFor(() => expect(raisedError('Results not found.')).toBe(true))
    expect(raisedError(FORBIDDEN)).toBe(false)
  })
})
