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
import { HIDDEN_DEFAULTS } from './fixtures/serverConfig'

const DEFAULTS = JSON.parse(readFileSync(resolve(process.cwd(), 'src/__tests__/fixtures/config_defaults.json'), 'utf8')) as {
  config: {
    supplier: { spot_spread: number; base_price: number }
    stock: { salvage_value: number }
    demand: { backlog_penalty: number }
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
    const { supplier, insurance } = DEFAULTS.config
    const hidden = [
      HIDDEN_DEFAULTS['supplier.disruption_probability'],
      supplier.spot_spread,
      HIDDEN_DEFAULTS['transport.failure_probability'],
      HIDDEN_DEFAULTS['transport.loss_fraction'],
      insurance.target_margin,
    ]
    const body = text()
    for (const value of hidden) {
      const percent = `${Math.round(value * 100)}%`
      expect(`${percent}: ${new RegExp(`(?<![\\d.])${percent}`).test(body)}`).toBe(`${percent}: false`)
    }
  })

  it('never quotes the base price, salvage price or backlog penalty players are not shown (spec §13.15)', () => {
    renderManual(Page)
    const { supplier, stock, demand } = DEFAULTS.config
    const body = text()
    for (const value of [supplier.base_price, stock.salvage_value, demand.backlog_penalty]) {
      const [whole, cents] = value.toFixed(2).split('.')
      // "$12", "$12.00" or "$1.50", but not "$12.40" or "$120"
      const pattern = new RegExp(cents === '00' ? `\\$${whole}(\\.00)?(?![\\d.])` : `\\$${whole}\\.${cents}(?!\\d)`)
      expect(`${value}: ${pattern.test(body)}`).toBe(`${value}: false`)
    }
    // and no example names a per-unit figure that adds up to the defaults either
    expect(body).not.toContain('($60)')
    expect(body).not.toContain('−$4.50')
    expect(body).not.toContain('salvaged for $12')
  })

  it('promises no timer or pause', () => {
    renderManual(Page)
    const body = text()
    expect(body).toMatch(/no timer/i)
    expect(body).not.toMatch(/countdown of|seconds (per|to) |time limit of|pause the game/i)
  })
})

describe('the manuals agree with the engine (spec §13.15)', () => {
  it('the player manual says what happens with a lead time of 0 and with one of 1 or more', () => {
    renderManual(PlayerManualPage)
    const body = text()
    expect(body).toContain('Spot orders close near the end only when the host sets a lead time')
    expect(body).toContain('with none, a spot order arrives the day you place it and spot stays open to the last day')
    expect(body).toContain('It is there only when the host sets a lead time')
    expect(body).toContain('A spot order arrives the same day, or after the lead time when the host sets one')
    expect(body).not.toContain('Spot orders close the same way near the end')
    expect(body).not.toContain('A spot order lands after the lead time')
  })

  it('the player manual states the rules the engine runs, not the old shortcuts', () => {
    renderManual(PlayerManualPage)
    const body = text()
    // quality counts tonight: a lot with no fresh nights reads below its arrival quality on arrival
    expect(body).toContain('a lot with no fresh nights reads below its arrival quality on the very day it arrives')
    expect(body).not.toContain('keeps its arrival quality through its fresh period')
    // holding cost is charged on what survives the night
    expect(body).toContain('Units that spoiled overnight pay none')
    expect(body).not.toContain('even if it survives')
    // spare capacity goes largest order first, never "split" or "shared" by default
    expect(body).toContain('the largest order first')
    expect(body).not.toMatch(/splits what is left between the spot orders|spot orders share whatever is left/)
    // reputation follows the day's score, and the recap arrow follows reputation
    expect(body).toContain('reputation can still rise after a day with some backlog')
    expect(body).toContain('The arrow says whether your reputation rose or fell that day')
    // Paid-price insurance refunds one average for the shipment
    expect(body).toContain('every lost unit is refunded at their average price, not at its own')
    // every recap example is marked as made up
    expect((body.match(/made-up numbers/g) ?? []).length).toBeGreaterThanOrEqual(4)
  })

  it('the host manual explains the hidden defaults and never blames a lead time it may not have', () => {
    renderManual(HostManualPage)
    const body = text()
    expect(body).toContain('Default (hidden)')
    expect(body).toContain('The results reveal the values the game ran with')
    expect(body).toContain('Hidden until the game ends')
    expect(body).not.toContain('Nobody was careless: lead time, perishability and scarce supply')
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

  it('explains every shipping insurance: its name, its meaning and its refund', () => {
    const body = text()
    for (const meaning of Object.values(INCOTERM_TIER_MEANINGS)) expect(body).toContain(meaning)
    expect(body).toContain('No insurance — you carry the risk')
    expect(body).toContain('Paid-price insurance — refund what you paid')
    expect(body).toContain('Market-price insurance — refund at the arrival-day spot price')
    expect(body).toContain('Retail-price insurance — refund at the retail price')
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
    for (const row of ['Buy from Supplier', 'Buy from Players', 'Futures', 'Shipping insurance', 'Conserve', 'Sell to Players', 'Equal Supply', 'Submit day']) {
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
