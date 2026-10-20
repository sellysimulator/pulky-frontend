/**
 * Spec §13.15 — the host and player manuals.
 *
 * Both are rendered under a bare MemoryRouter: no auth, backend-status or
 * store provider, so a manual that reads any of them fails here.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { forwardRef, useImperativeHandle, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const flip = vi.hoisted(() => ({
  next: vi.fn(),
  prev: vi.fn(),
  onFlip: null as ((event: { data: number }) => void) | null,
}))

vi.mock('react-pageflip', () => ({
  default: forwardRef(function FlipStub(
    { children, onFlip }: { children: ReactNode; onFlip(event: { data: number }): void },
    ref,
  ) {
    useImperativeHandle(ref, () => ({ pageFlip: () => ({ flipNext: flip.next, flipPrev: flip.prev }) }))
    flip.onFlip = onFlip
    return <div data-testid="flip-book">{children}</div>
  }),
}))

const io = vi.hoisted(() => vi.fn())
vi.mock('socket.io-client', () => ({ io, default: io }))

import { SECTION_PATHS } from '../components/config/configDraft'
import { DOCS } from '../components/config/docs/entries'
import HostManualPage, { route as hostRoute } from '../pages/HostManualPage'
import PlayerManualPage, { route as playerRoute } from '../pages/PlayerManualPage'
import { getRoutes } from '../routes/registry'
import { INCOTERM_TIER_MEANINGS } from '../utils/format'

const DEFAULTS = JSON.parse(readFileSync(resolve(process.cwd(), 'src/__tests__/fixtures/config_defaults.json'), 'utf8')) as {
  config: {
    supplier: { disruption_probability: number; spot_spread: number }
    transport: { failure_probability: number; loss_fraction: number }
    insurance: { target_margin: number }
  }
}

const MANUALS = [
  { name: 'player', path: '/player-manual', Page: PlayerManualPage, route: playerRoute },
  { name: 'host', path: '/host-manual', Page: HostManualPage, route: hostRoute },
] as const

function renderManual(Page: () => ReactNode) {
  return render(
    <MemoryRouter>
      <Page />
    </MemoryRouter>,
  )
}

function text(): string {
  return (document.body.textContent ?? '').replace(/\s+/g, ' ')
}

function wideWindow(matches: boolean): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  )
}

let fetchSpy: ReturnType<typeof vi.fn>
let xhrOpen: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
  xhrOpen = vi.spyOn(XMLHttpRequest.prototype, 'open')
  flip.onFlip = null
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe.each(MANUALS)('the $name manual', ({ path, Page, route }) => {
  it(`is public at ${path} and registered`, () => {
    expect(route).toEqual({ path, guard: 'public' })
    expect(getRoutes().find((r) => r.path === path)?.guard).toBe('public')
  })

  it('renders with no provider and reaches no backend', () => {
    renderManual(Page)
    expect(text().length).toBeGreaterThan(2000)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrOpen).not.toHaveBeenCalled()
    expect(io).not.toHaveBeenCalled()
  })

  it('stacks the pages where a spread does not fit, each with its running number', () => {
    renderManual(Page)
    expect(screen.queryByTestId('flip-book')).toBeNull()
    const sections = document.querySelectorAll('main section[id]')
    expect(sections.length % 2).toBe(0)
    expect(sections[0].id).toBe('cover')
    expect(sections[1].id).toBe('contents')
    expect(sections[sections.length - 1].id).toBe('back-cover')
  })

  it('lists every page once in the contents, under its real number', () => {
    renderManual(Page)
    const contents = document.getElementById('contents') as HTMLElement
    const entries = within(contents).getAllByRole('listitem')
    expect(entries.length).toBeGreaterThan(10)
    const sections = Array.from(document.querySelectorAll('main section[id]'))
    for (const entry of entries) {
      const [number, heading] = Array.from(entry.querySelectorAll('span')).map((s) => s.textContent ?? '')
      const index = sections.findIndex((s) => s.querySelector('h2')?.textContent === heading)
      expect(`${heading}: ${index + 1}`).toBe(`${heading}: ${number}`)
    }
    expect(within(contents).queryByText(/, continued$/)).toBeNull()
  })

  it('never states the default of a setting players are not shown (spec §9.3)', () => {
    renderManual(Page)
    const { supplier, transport, insurance } = DEFAULTS.config
    const hidden = [
      supplier.disruption_probability,
      supplier.spot_spread,
      transport.failure_probability,
      transport.loss_fraction,
      insurance.target_margin,
    ]
    const body = text()
    for (const value of hidden) {
      const percent = `${Math.round(value * 100)}%`
      expect(`${percent}: ${new RegExp(`(?<![\\d.])${percent}`).test(body)}`).toBe(`${percent}: false`)
    }
  })

  it('promises no timer or pause', () => {
    renderManual(Page)
    const body = text()
    expect(body).toMatch(/no timer/i)
    expect(body).not.toMatch(/countdown of|seconds (per|to) |time limit of|pause the game/i)
  })
})

describe('the player manual', () => {
  beforeEach(() => {
    renderManual(PlayerManualPage)
  })

  it('names every hazard and what it does', () => {
    for (const heading of ['Quality and spoilage', 'Supplier disruption', 'Short supply', 'Refrigeration failure', 'Price swings and cash']) {
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument()
    }
    expect(text()).toMatch(/futures due that day are filled first/)
    expect(text()).toMatch(/hits every shipment sent that day/)
  })

  it('explains every incoterm tier: its name, its meaning and its refund', () => {
    const body = text()
    for (const meaning of Object.values(INCOTERM_TIER_MEANINGS)) expect(body).toContain(meaning)
    expect(body).toContain('EXW — you carry the risk')
    expect(body).toContain('CIP + blockchain — refund what you paid')
    expect(body).toContain('DAP + blockchain — refund at market price')
    expect(body).toContain('DDP + blockchain — refund at retail price')
    expect(body).toMatch(/whether or not anything fails/)
  })

  it('explains futures: paid today at the base price, served first, refunded when unfilled', () => {
    const body = text()
    expect(body).toMatch(/Paid today, in full/)
    expect(body).toMatch(/futures are filled before any spot order/)
    expect(body).toMatch(/cancelled and refunded at the base price/)
    expect(body).toContain('Futures closed: deliveries would arrive after the game ends')
  })

  it('explains how to change the board view and what 3D needs', () => {
    const body = text()
    expect(body).toMatch(/Board view switch \( ?2D \| 3D ?\)/)
    expect(body).toContain('1,024 pixels')
    expect(body).toMatch(/goes back to its starting values/)
    expect(screen.getByRole('table', { name: 'Controls' })).toHaveTextContent('W A S D')
    expect(screen.getByRole('table', { name: 'Stations' })).toHaveTextContent('The counter')
  })

  it("names every section of the game screen and every row of today's decision", () => {
    const body = text()
    for (const name of ['Day stats', 'Yesterday', "Today's decision", 'Your cellar', 'Market', 'Details']) expect(body).toContain(name)
    for (const row of ['Buy from Supplier', 'Buy from Players', 'Futures', 'Shipping Details (Incoterm)', 'Conserve', 'Sell to Players', 'Equal Supply', 'Submit day']) {
      expect(body).toContain(row)
    }
  })
})

describe('the host manual', () => {
  beforeEach(() => {
    renderManual(HostManualPage)
  })

  it('has a page for every config section, in the config panel order', () => {
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    const order = ['Game', 'Demand', 'Reputation', 'Supplier & futures', 'Stock', 'Peer market', 'Transport & insurance'].map((h) =>
      headings.indexOf(h),
    )
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it("lists every setting with its help entry's label and effect", () => {
    const terms = screen.getAllByRole('term').map((t) => t.textContent ?? '')
    const paths = [...Object.values(SECTION_PATHS).flat(), 'insurance.reference_shipment', 'insurance.target_margin']
    for (const path of paths) {
      expect(terms.some((t) => t.startsWith(DOCS[path].label))).toBe(true)
      if (typeof DOCS[path].effect === 'string') expect(text()).toContain(DOCS[path].effect as string)
    }
  })

  it('badges the five shown settings and the secret ones', () => {
    const terms = screen.getAllByRole('term')
    expect(terms.filter((t) => within(t).queryByText('Shown to players')).length).toBe(5)
    expect(terms.filter((t) => within(t).queryByText('Secret')).length).toBe(6)
  })

  it('covers running the session and the debrief', () => {
    const body = text()
    for (const control of ['Start game', 'Presentation mode', 'End game early', 'See the results', 'Reveal', 'Export CSV', 'Play again', 'Debrief notes']) {
      expect(body).toContain(control)
    }
  })
})

describe('the book', () => {
  beforeEach(() => {
    wideWindow(true)
    renderManual(PlayerManualPage)
  })

  it('turns pages with the buttons and the arrow keys', () => {
    expect(screen.getByTestId('flip-book')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(flip.next).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(flip.prev).toHaveBeenCalledTimes(2)
  })

  it('shows the page the library reports', () => {
    const total = within(screen.getByTestId('flip-book')).getAllByRole('heading', { level: 2 }).length + 2
    expect(screen.getByText(`Page 1 of ${total}`)).toBeInTheDocument()
    act(() => flip.onFlip?.({ data: 3 }))
    expect(screen.getByText(`Page 4 of ${total}`)).toBeInTheDocument()
  })
})
