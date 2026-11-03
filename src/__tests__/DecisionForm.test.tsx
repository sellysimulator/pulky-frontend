/**
 * Section 26 - DecisionForm: layout, prefill, outlay, submit, validity, locking,
 * closed windows and the conserve rows.
 * Acceptance criteria 1, 2, 4, 5, 6, 9, 10, 14; failure modes 3, 4, 5, 9, 13.
 * Queries are by role, label or text; copy is only what the spec or the section document quotes.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Spec §12.4: every figure on the form is the server's answer to preview_decision; a double stands in for it.
const server = vi.hoisted(() => ({ preview: vi.fn() }))
vi.mock('../api/games', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/games')>()),
  previewDecision: server.preview,
}))

import DecisionForm from '../components/game/DecisionForm'
import { useGameStore } from '../store/gameStore'
import type { Decision, PlayerView, PublicConfig, QualityGuideRow } from '../types/game'
import { ROOM, serveDecisionPreviews } from './fixtures/fakeDecisionServer'
import { SERVER_LIMITS, seedServerLimits } from './fixtures/serverConfig'

type Props = React.ComponentProps<typeof DecisionForm>

function lot(id: string, qty: number, quality: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    qty,
    age: 1,
    unit_cost: 12,
    initial_quality: 100,
    conserved: false,
    quality,
    days_left: 3, // through day 7, from day 5
    last_day: 7,
    risk_tonight: (100 - quality) / 100,
    expected_loss_tonight: (qty * (100 - quality)) / 100,
    conservation_cost: extra.conserved === true ? null : qty, // $1.00 a unit
    ...extra,
  }
}

/** Distinct, index-revealing guide rows: last_day = 30 + quality / 5, so a row read by the wrong index differs. */
function makeGuide(): QualityGuideRow[] {
  const rows: QualityGuideRow[] = []
  for (let q = 100; q >= 0; q -= 5) {
    rows.push({ quality: q, half_spoiled_day: q === 0 ? 5 : 6, days_left: q === 0 ? 1 : 26 + q / 5, last_day: q === 0 ? 5 : 30 + q / 5 })
  }
  const r90 = rows.find((r) => r.quality === 90)!
  r90.half_spoiled_day = 7
  r90.last_day = 8
  r90.days_left = 4
  return rows
}

interface ViewOverrides {
  cellar?: Array<Record<string, unknown>>
  futures_book?: Array<{ contract_day: number; ships_day: number; delivery_day: number; qty: number }>
  plans?: Array<Record<string, unknown>>
  cash?: number
  day?: number
  order_windows?: Record<string, unknown>
}

function makePlans(disabled: string[] = []) {
  const all = [
    { tier: 'exw', label: 'EXW', enabled: true, refund_basis: 'none', refund_value_today: null, refund_shipment: null, fee_per_unit: 0 },
    { tier: 'cip', label: 'CIP', enabled: true, refund_basis: 'paid', refund_value_today: 13.4, refund_shipment: null, fee_per_unit: 0.55 },
    { tier: 'dap', label: 'DAP', enabled: true, refund_basis: 'arrival_spot', refund_value_today: null, refund_shipment: null, fee_per_unit: 0.55 },
    { tier: 'ddp', label: 'DDP', enabled: true, refund_basis: 'retail', refund_value_today: 30, refund_shipment: null, fee_per_unit: 1.39 },
  ]
  return all.map((p) => (disabled.includes(p.tier) ? { ...p, enabled: false } : p))
}

/** The spec 13.7 mock, day 5. */
function makeView(o: ViewOverrides = {}): PlayerView {
  const day = o.day ?? 5
  const view = {
    alias: 'P1',
    display_name: 'Don Agave',
    day,
    duration_days: 14,
    weekday: 'fri',
    phase: 'deciding',
    has_submitted: false,
    awaiting: [],
    brief: {
      day,
      duration_days: 14,
      weekday: 'fri',
      weekday_multiplier: 1,
      weekday_multipliers: { mon: 0.25, tue: 0.5, wed: 0.75, thu: 1, fri: 1, sat: 1, sun: 0.75 },
      expected_demand: 100,
      supplier: { disrupted: false, disruption_message: null, spot_price: 13.4, base_price: 12, lead_time_days: 1 },
      spot: { open: true, arrives_day: 6, arrives_weekday: 'sat' },
      futures: { open: true, price: 12, horizon_days: 7, delivery_day: 12, delivery_weekday: 'fri', last_day_to_buy: 7, days_left_to_buy: 3 },
      transport: { shared: false },
      reputation: { P1: 0.62 },
    },
    yesterday: null,
    cellar: o.cellar ?? [lot('L3', 12, 0), lot('L4', 30, 23)],
    stock_by_age: [],
    quality_guide: makeGuide(),
    expected_spoil_tonight: 0,
    in_transit: [],
    futures_book: o.futures_book ?? [],
    backlog: 0,
    expected_demand_own: 27,
    reputation: 0.62,
    market_share: 0.25,
    cash: o.cash ?? 6120,
    cumulative_profit: 0,
    tier_plans: o.plans ?? makePlans(),
    order_windows: {
      spot_open: true,
      futures_open: true,
      futures_days_left_to_buy: 3,
      futures_message: 'Futures: 3 days left to buy (delivery in 7 days, at $12.00)',
      spot_message: null,
      ...(o.order_windows ?? {}),
    },
    prefill_decision: null,
    final_settlement: null,
    full: true,
  }
  return view as unknown as PlayerView
}

function makeConfig(peer = true): PublicConfig {
  return {
    demand: { retail_price: 30 },
    stock: { conservation_extra_fresh_days: 2, conservation_cost_per_unit: 1 },
    peer_market: { enabled: peer },
    transport: { unit_cost: 1 },
  }
}

/** The mock's server prefill: yesterday's decision with conserve emptied and peer rows off. */
function makePrefill(over: Partial<Decision> = {}): Decision {
  return {
    day: 5,
    order_spot: 40,
    order_futures: 25,
    incoterm_tier: 'cip',
    conserve_lots: [],
    cooperate: true,
    peer_buy: null,
    peer_sell: null,
    ...over,
  }
}

function renderForm(over: Partial<Props> = {}) {
  const onSubmit = vi.fn()
  const props: Props = {
    view: makeView(),
    config: makeConfig(),
    initialDecision: makePrefill(),
    locked: false,
    onSubmit,
    ...over,
  }
  serveDecisionPreviews(server.preview, props.view, props.config)
  const utils = render(<DecisionForm {...props} />)
  return {
    ...utils,
    onSubmit: props.onSubmit as ReturnType<typeof vi.fn>,
    rerenderForm: (next: Partial<Props>) => {
      serveDecisionPreviews(server.preview, next.view ?? props.view, next.config ?? props.config)
      utils.rerender(<DecisionForm {...props} {...next} />)
    },
  }
}

/** Waits for the server's answer to the draft on screen to show on the card. */
const eventually = (text: string) => waitFor(() => expect(cardHas(text)).toBe(true))

const card = () => screen.getByRole('region', { name: "Today's decision" })
const squash = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, '')
const cardHas = (text: string) => squash(card().textContent).includes(squash(text))
const input = (name: string | RegExp) => screen.getByLabelText(name) as HTMLInputElement
const spot = () => input('Buy from Supplier')
const futures = () => input('Futures')
const submitBtn = () => screen.getByRole('button', { name: 'Submit day' })
const setField = (el: HTMLElement, v: string | number) => fireEvent.change(el, { target: { value: String(v) } })
const blur = (el: HTMLElement) => fireEvent.blur(el)

const SHORT_TICK = /Buy the shortfall from other pulquerías/
const SELL_TICK = /Offer units to other pulquerías/
const buyBox = () => screen.getByRole('checkbox', { name: SHORT_TICK })
const sellBox = () => screen.getByRole('checkbox', { name: SELL_TICK })
const buyPrice = () => input(/^up to$/i)
const buyQuality = () => input(/^quality at least$/i)
const sellPrice = () => input(/^at$/i)
const sellQuality = () => input(/^quality up to$/i)
const sellUnits = () => input(/^max$/i)
const lotBox = (id: string) => screen.getByRole('checkbox', { name: new RegExp(`^Lot #${id.replace(/^L/, '')} ·`) })
const radio = (label: string) => screen.getByRole('radio', { name: new RegExp(`^${label}`) })

/** Focuses the named info button and returns its open tooltip's text. */
function tipText(name: string): string {
  const button = screen.getByRole('button', { name: `About ${name}` })
  act(() => button.focus())
  return squash(screen.getByRole('tooltip').textContent)
}

/** The text an input points at through aria-describedby (the NumberField error line sits there). */
function described(el: HTMLElement): string {
  const ids = (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)
  return ids.map((i) => document.getElementById(i)?.textContent ?? '').join(' ')
}

const MSG_QTY = 'Orders must be whole numbers from 0 to 9,999.'

// Spec §13.6: the form's upper bounds are the server's, loaded once the backend is awake.
beforeEach(seedServerLimits)

function RICH_VIEW(): PlayerView {
  return makeView({ cash: 1e9 })
}

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, a[href], [tabindex]:not([tabindex="-1"])'

function expectDomOrder(elements: HTMLElement[]) {
  for (let i = 1; i < elements.length; i++) {
    const follows = elements[i - 1].compareDocumentPosition(elements[i]) & Node.DOCUMENT_POSITION_FOLLOWING
    expect(follows, `element ${i} must follow element ${i - 1}`).toBeTruthy()
  }
}

describe('layout (acceptance criterion 1)', () => {
  it('renders the eight rows in order with the peer market on', () => {
    renderForm()
    expect(card()).toBeInTheDocument()
    expectDomOrder([
      spot(),
      buyBox(),
      futures(),
      screen.getByRole('group', { name: 'Shipping insurance' }),
      lotBox('L3'),
      lotBox('L4'),
      sellBox(),
      screen.getByRole('switch', { name: 'Vote for equal supply' }),
      screen.getByText(/Today:/),
      submitBtn(),
    ])
    expect(cardHas('Conserving')).toBe(false)
    expect(tipText('Conserve')).toContain(squash('Conserving a lot adds 2 nights to its fresh period, at $1.00/unit paid today.'))
  })

  it('every row with an explanation carries it in an info tooltip, closed at rest', () => {
    renderForm()
    expect(screen.queryByRole('tooltip')).toBeNull()
    for (const name of ['Buy from Supplier', 'Buy from Players', 'Futures', 'Shipping insurance', 'Conserve', 'Sell to Players', 'Equal Supply']) {
      expect(tipText(name).length).toBeGreaterThan(20)
    }
  })

  it('Buy from Players says only a spot shortfall can be bought from rivals, never a futures one (spec §5.7)', () => {
    renderForm()
    const tip = tipText('Buy from Players')
    expect(tip).toContain(squash('If the supplier fills only part of your spot order, buy the missing spot units today'))
    expect(tip).toContain(squash('Futures the supplier cannot ship are refunded, not bought from rivals.'))
    expect(tip).not.toContain(squash('cannot fill your whole order'))
  })

  it('renders six rows without If short and Sell when the peer market is off', () => {
    renderForm({ config: makeConfig(false) })
    expect(screen.queryByRole('checkbox', { name: SHORT_TICK })).toBeNull()
    expect(screen.queryByRole('checkbox', { name: SELL_TICK })).toBeNull()
    expect(screen.queryByLabelText(/^quality at least$/i)).toBeNull()
    expect(screen.queryByLabelText(/^quality up to$/i)).toBeNull()
    expectDomOrder([
      spot(),
      futures(),
      screen.getByRole('group', { name: 'Shipping insurance' }),
      lotBox('L3'),
      lotBox('L4'),
      screen.getByRole('switch', { name: 'Vote for equal supply' }),
      screen.getByText(/Today:/),
      submitBtn(),
    ])
  })

  it('failure mode 4: Submit day is the last focusable element of the card', () => {
    renderForm()
    const focusables = Array.from(card().querySelectorAll<HTMLElement>(FOCUSABLE))
    expect(focusables.length).toBeGreaterThan(6)
    const last = focusables[focusables.length - 1]
    expect(last).toBe(submitBtn())
  })

  it('failure mode 4: still last when both peer rows are ticked and filled (more inputs above it)', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(buyBox())
    await user.click(sellBox())
    setField(buyPrice(), 16)
    setField(buyQuality(), 90)
    setField(sellPrice(), 15)
    setField(sellQuality(), 60)
    setField(sellUnits(), 10)
    const focusables = Array.from(card().querySelectorAll<HTMLElement>(FOCUSABLE))
    expect(focusables[focusables.length - 1]).toBe(submitBtn())
    // nothing after Submit day, anywhere in the card's DOM order
    const all = Array.from(card().querySelectorAll<HTMLElement>('input, button, summary, [role="switch"]'))
    const after = all.filter((el) => submitBtn().compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(after).toEqual([])
  })

  it('spot and futures rows carry their context from the brief', () => {
    renderForm()
    expect(cardHas('$13.40 · arrives day 6 (Saturday)')).toBe(true)
    expect(cardHas('$12.00 · delivered day 12 (Friday)')).toBe(true)
    expect(cardHas('3 days left to buy')).toBe(true)
  })

  it('never shows the supplier capacity', () => {
    renderForm()
    expect(cardHas('capacity')).toBe(false)
    expect(tipText('Buy from Supplier')).not.toMatch(/capacity/i)
  })

  it('the spot and futures tooltips explain the order, with its days', () => {
    renderForm()
    expect(tipText('Buy from Supplier')).toContain(squash("Bought at today's spot price, arriving on day 6 (Saturday). You pay only for the units the supplier fills."))
    expect(tipText('Futures')).toContain(squash('Bought at the base price of $12.00 and paid today, delivered on day 12 (Friday).'))
    expect(tipText('Futures')).toContain(squash('units the supplier cannot ship are refunded'))
  })

  it('the futures countdown is a neutral chip, and a warning chip on the last day to buy', () => {
    const { unmount } = renderForm()
    expect(screen.getByText('3 days left to buy').closest('[class*="warning"]')).toBeNull()
    unmount()
    const view = makeView()
    renderForm({ view: { ...view, brief: { ...view.brief!, futures: { ...view.brief!.futures, days_left_to_buy: 1 } } } })
    expect(screen.getByText('Last day to buy').closest('[class*="warning"]')).not.toBeNull()
  })

  it("bounds the quantity fields at 0..MAX_ORDER, the server's limit (spec §13.6)", () => {
    renderForm()
    expect(SERVER_LIMITS.MAX_ORDER).toBe(9999)
    expect(spot()).toHaveAttribute('min', '0')
    expect(spot()).toHaveAttribute('max', '9999')
    expect(futures()).toHaveAttribute('min', '0')
    expect(futures()).toHaveAttribute('max', '9999')
  })

  it("takes the upper bound from the store and the message from the server: a different server limit moves both", async () => {
    useGameStore.setState({ limits: { ...SERVER_LIMITS, MAX_ORDER: 500 } })
    const { unmount } = renderForm({ view: RICH_VIEW() })
    expect(spot()).toHaveAttribute('max', '500')
    setField(spot(), '501')
    blur(spot())
    expect(await screen.findByText('Orders must be whole numbers from 0 to 500.')).toBeInTheDocument()
    unmount()
    useGameStore.setState({ limits: null })
    renderForm({ view: RICH_VIEW() })
    expect(spot()).not.toHaveAttribute('max')
  })

  it('refuses a negative quantity: a minus sign never reaches the spot, futures or peer fields', async () => {
    const { onSubmit } = renderForm({ view: RICH_VIEW() })
    for (const field of [spot(), futures()]) {
      setField(field, '-5')
      expect(field).not.toHaveValue('-5')
    }
    await userEvent.setup().click(submitBtn())
    const sent = onSubmit.mock.calls[0][0] as Decision
    expect(sent.order_spot).toBeGreaterThanOrEqual(0)
    expect(sent.order_futures).toBeGreaterThanOrEqual(0)
  })
})

describe('state and prefill (acceptance criterion 2)', () => {
  it('renders nothing for a finished view, which has no prefill and no order windows (spec 12.4)', () => {
    const { container } = renderForm({
      view: { ...makeView(), phase: 'finished', order_windows: null },
      initialDecision: null,
    })
    expect(container).toBeEmptyDOMElement()
  })

  it('on day 1 the zero decision shows zeros, EXW, no conserve ticks and both peer rows unticked', () => {
    renderForm({
      view: makeView({ day: 1 }),
      initialDecision: makePrefill({ day: 1, order_spot: 0, order_futures: 0, incoterm_tier: 'exw', cooperate: false }),
    })
    expect(spot().value).toBe('0')
    expect(futures().value).toBe('0')
    expect(radio('EXW')).toBeChecked()
    expect(lotBox('L3')).not.toBeChecked()
    expect(lotBox('L4')).not.toBeChecked()
    expect(buyBox()).not.toBeChecked()
    expect(sellBox()).not.toBeChecked()
    expect(screen.getByRole('switch', { name: 'Vote for equal supply' })).toHaveAttribute('aria-checked', 'false')
  })

  it("starts from the server's prefill", () => {
    renderForm()
    expect(spot().value).toBe('40')
    expect(futures().value).toBe('25')
    expect(radio('CIP')).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Vote for equal supply' })).toHaveAttribute('aria-checked', 'true')
    expect(buyBox()).not.toBeChecked()
    expect(sellBox()).not.toBeChecked()
  })

  it('a prefill with peer limits starts both rows ticked with those values', () => {
    renderForm({
      initialDecision: makePrefill({
        peer_buy: { max_price: 16, min_quality: 90 },
        peer_sell: { price: 15, max_quality: 60, max_units: 10 },
      }),
    })
    expect(buyBox()).toBeChecked()
    expect(sellBox()).toBeChecked()
    expect(Number(buyPrice().value)).toBe(16)
    expect(Number(buyQuality().value)).toBe(90)
    expect(Number(sellPrice().value)).toBe(15)
    expect(Number(sellQuality().value)).toBe(60)
    expect(Number(sellUnits().value)).toBe(10)
  })

  it("a new day's prefill replaces the draft", () => {
    const { rerenderForm } = renderForm()
    setField(spot(), 77)
    expect(spot().value).toBe('77')
    rerenderForm({
      view: makeView({ day: 6 }),
      initialDecision: makePrefill({ day: 6, order_spot: 8, order_futures: 3, incoterm_tier: 'exw', cooperate: false }),
    })
    expect(spot().value).toBe('8')
    expect(futures().value).toBe('3')
    expect(radio('EXW')).toBeChecked()
  })

  it('failure mode 5: a re-sent state for the same day does not reset what the player typed', async () => {
    const user = userEvent.setup()
    const { rerenderForm } = renderForm()
    setField(spot(), 77)
    setField(futures(), 5)
    await user.click(radio('DAP'))
    await user.click(lotBox('L4'))
    rerenderForm({
      view: makeView({ cash: 5000 }),
      initialDecision: makePrefill({ order_spot: 40, order_futures: 99, incoterm_tier: 'cip' }),
    })
    expect(spot().value).toBe('77')
    expect(futures().value).toBe('5')
    expect(radio('DAP')).toBeChecked()
    expect(lotBox('L4')).toBeChecked()
  })

  it('a prefilled tier that is not enabled falls back to EXW', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm({
      view: makeView({ plans: makePlans(['dap']) }),
      initialDecision: makePrefill({ incoterm_tier: 'dap' }),
    })
    expect(radio('EXW')).toBeChecked()
    await user.click(submitBtn())
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0].incoterm_tier).toBe('exw')
  })
})

/** Lets the debounce run out and the double answer the draft on screen. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 300)))

describe('the server preview (spec 12.4)', () => {
  it('asks the server for the draft as typed, once the typing pauses, never computing a figure itself', async () => {
    renderForm()
    await waitFor(() => expect(server.preview).toHaveBeenCalled())
    expect(server.preview).toHaveBeenLastCalledWith(ROOM, {
      day: 5,
      order_spot: 40,
      order_futures: 25,
      incoterm_tier: 'cip',
      conserve_lots: [],
      cooperate: true,
      peer_buy: null,
      peer_sell: null,
    })
    server.preview.mockClear()
    setField(spot(), 4)
    setField(spot(), 41)
    setField(spot(), 412)
    await settle()
    // three keystrokes, one question: the last draft
    expect(server.preview).toHaveBeenCalledTimes(1)
    expect(server.preview.mock.calls[0][1]).toMatchObject({ order_spot: 412 })
  })

  it('shows a placeholder while the answer is on its way, then the server total', async () => {
    let release: (v: unknown) => void = () => {}
    renderForm()
    server.preview.mockImplementationOnce(() => new Promise((r) => (release = r)))
    expect(cardHas('Today: … of $6,120.00')).toBe(true)
    await settle()
    expect(cardHas('Today: … of $6,120.00')).toBe(true)
    await act(async () =>
      release({ preview: { day: 5, outlay: { spot: 1, futures: 2, shipping: 3, conservation: 4, total: 1234.5 }, affordable: true, unaffordable_message: null, shipment_units: 40, tier_plans: null, offer: null, errors: [] } }),
    )
    expect(cardHas('Today: $1,234.50 of $6,120.00')).toBe(true)
  })

  it('drops an answer for an older draft', async () => {
    const answers: Array<(v: unknown) => void> = []
    renderForm()
    server.preview.mockImplementation(() => new Promise((r) => answers.push(r)))
    await settle()
    setField(spot(), 7)
    await settle()
    const answer = (total: number) => ({ preview: { day: 5, outlay: { spot: 0, futures: 0, shipping: 0, conservation: 0, total }, affordable: true, unaffordable_message: null, shipment_units: 0, tier_plans: null, offer: null, errors: [] } })
    await act(async () => answers.at(-2)?.(answer(111)))
    expect(cardHas('Today: $111.00')).toBe(false)
    await act(async () => answers.at(-1)?.(answer(222)))
    expect(cardHas('Today: $222.00 of $6,120.00')).toBe(true)
  })
})

describe('outlay line and bar (acceptance criterion 4)', () => {
  it("shows the server's Today: total of cash as quantities, tier and ticks change", async () => {
    const user = userEvent.setup()
    renderForm()
    // spec 8.3 worked example: 40 x 13.40 + 25 x 12.00 + 40 x (1.00 + 0.55) = 898
    await eventually('Today: $898.00 of $6,120.00')
    await user.click(lotBox('L3'))
    await eventually('Today: $910.00 of $6,120.00')
    setField(spot(), 50)
    await eventually('Today: $1,059.50 of $6,120.00')
    await user.click(radio('EXW'))
    await eventually('Today: $1,032.00 of $6,120.00')
    setField(futures(), 0)
    await eventually('Today: $732.00 of $6,120.00')
    expect(server.preview.mock.lastCall?.[1]).toMatchObject({ order_spot: 50, order_futures: 0, incoterm_tier: 'exw', conserve_lots: ['L3'] })
  })

  it("shows the server's fee estimate for today's shipment in the chosen tier's tooltip", async () => {
    renderForm({ view: makeView({ futures_book: [{ contract_day: 0, ships_day: 5, delivery_day: 6, qty: 10 }] }) })
    // the server's fee_for_shipment: 0.55 x (40 spot + 10 due)
    await settle()
    expect(tipText('CIP details')).toContain(squash("~$27.50 for today's shipment"))
  })

  it("Paid-price card follows the spot order as it is typed (spec 6.3 example, the server's figure)", async () => {
    // the view's own card, as the server sends it with 20 futures due: the held order's average
    const plans = makePlans().map((p) =>
      p.tier === 'cip' ? { ...p, refund_value_today: 13.02, refund_shipment: { spot_units: 40, futures_units: 20 } } : p,
    )
    renderForm({ view: makeView({ plans: plans as never, futures_book: [{ contract_day: 0, ships_day: 5, delivery_day: 6, qty: 20 }] }) })
    setField(spot(), 20)
    await settle()
    // the double answers what the server would: (20 x 13.40 + 20 x 12.00) / 40
    expect(tipText('CIP details')).toContain(squash('Refund per lost unit: $12.70, the average price of today'))
    setField(spot(), 60)
    expect(tipText('CIP details')).toContain(squash('Refund per lost unit: …'))
    await settle()
    expect(tipText('CIP details')).toContain(squash('60 spot and 20 futures units'))
  })

  it('failure mode 9: a peer purchase limit is sent but the server adds nothing for it', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(lotBox('L3'))
    await user.click(buyBox())
    setField(buyPrice(), 16)
    setField(buyQuality(), 90)
    await eventually('Today: $910.00 of $6,120.00')
    expect(server.preview.mock.lastCall?.[1]).toMatchObject({ peer_buy: { max_price: 16, min_quality: 90 } })
  })
})

describe('Submit day and affordability (acceptance criteria 5 and 9)', () => {
  async function tickMock(user: ReturnType<typeof userEvent.setup>) {
    await user.click(lotBox('L3'))
  }

  it('failure mode 3: at exactly the cash Submit day is enabled', async () => {
    const user = userEvent.setup()
    renderForm({ view: makeView({ cash: 910 }) })
    await tickMock(user)
    await eventually('Today: $910.00 of $910.00')
    expect(submitBtn()).toBeEnabled()
  })

  it("over the cash the server says so: Submit day is disabled and the server's spec 4.3 line shows", async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm({ view: makeView({ cash: 909.99 }) })
    await tickMock(user)
    await waitFor(() => expect(submitBtn()).toBeDisabled())
    expect(cardHas("Today's purchases cost $910.00 but you only have $909.99")).toBe(true)
    await user.click(submitBtn())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('acceptance criterion 5: an invalid field never disables Submit day; the press shows its message', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm({ view: makeView({ cash: 100 }) })
    setField(spot(), '1')
    setField(futures(), '')
    await settle()
    expect(submitBtn()).toBeEnabled()
    await user.click(submitBtn())
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(MSG_QTY)).toBeInTheDocument()
  })

  it('the over-cash line is absent while the outlay fits', async () => {
    renderForm()
    await eventually('Today: $898.00 of $6,120.00')
    expect(cardHas("Today's purchases cost")).toBe(false)
  })

  it('with cash <= 0 only the zero-outlay decision can be submitted', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm({
      view: makeView({ cash: -20, futures_book: [{ contract_day: 0, ships_day: 5, delivery_day: 6, qty: 10 }] }),
      initialDecision: makePrefill({ order_spot: 0, order_futures: 0, incoterm_tier: 'exw', cooperate: false }),
    })
    await settle()
    expect(submitBtn()).toBeEnabled()
    setField(spot(), 1)
    await waitFor(() => expect(submitBtn()).toBeDisabled())
    setField(spot(), 0)
    await waitFor(() => expect(submitBtn()).toBeEnabled())
    await user.click(submitBtn())
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('submits once with the full decision of the worked example (acceptance criterion 9)', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()
    await user.click(lotBox('L3'))
    await user.click(buyBox())
    setField(buyPrice(), 16)
    setField(buyQuality(), 90)
    await user.click(sellBox())
    setField(sellPrice(), 15)
    setField(sellQuality(), 60)
    setField(sellUnits(), 10)
    await settle()
    await user.click(submitBtn())
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      day: 5,
      order_spot: 40,
      order_futures: 25,
      incoterm_tier: 'cip',
      conserve_lots: ['L3'],
      cooperate: true,
      peer_buy: { max_price: 16, min_quality: 90 },
      peer_sell: { price: 15, max_quality: 60, max_units: 10 },
    })
  })

  it('both rows unticked submit both keys as null', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()
    await user.click(submitBtn())
    const sent = onSubmit.mock.calls[0][0]
    expect(sent).toEqual({
      day: 5,
      order_spot: 40,
      order_futures: 25,
      incoterm_tier: 'cip',
      conserve_lots: [],
      cooperate: true,
      peer_buy: null,
      peer_sell: null,
    })
  })

  it('sends conserve_lots in cellar order whatever the tick order, and the typed tier and vote', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()
    await user.click(lotBox('L4'))
    await user.click(lotBox('L3'))
    await user.click(radio('DDP'))
    await user.click(screen.getByRole('switch', { name: 'Vote for equal supply' }))
    setField(spot(), 3)
    setField(futures(), 0)
    await settle()
    await user.click(submitBtn())
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      day: 5,
      order_spot: 3,
      order_futures: 0,
      incoterm_tier: 'ddp',
      conserve_lots: ['L3', 'L4'],
      cooperate: false,
    })
  })
})

const RICH = RICH_VIEW() // an order of 10,000 units must not also be over the cash

describe('quantity validity, from the server (acceptance criteria 5 and 16)', () => {
  it.each([
    ['an empty spot field', () => spot(), ''],
    ['a spot order above 9,999', () => spot(), '10000'],
    ['an empty futures field', () => futures(), ''],
    ['a futures order above 9,999', () => futures(), '10000'],
  ])("%s shows the server's spec message once left, and Submit day stays enabled", async (_name, field, value) => {
    renderForm({ view: RICH })
    setField(field(), value)
    blur(field())
    await settle()
    expect(described(field())).toContain(MSG_QTY)
    expect(field()).toHaveAttribute('aria-invalid', 'true')
    expect(submitBtn()).toBeEnabled()
  })

  it('failure mode 16: emptying a quantity field that still has focus shows no message; leaving it shows the message', async () => {
    renderForm({ view: RICH })
    act(() => spot().focus())
    setField(spot(), '')
    await settle()
    expect(screen.queryByText(MSG_QTY)).toBeNull()
    expect(spot()).not.toHaveAttribute('aria-invalid')
    act(() => spot().blur())
    expect(screen.getByText(MSG_QTY)).toBeInTheDocument()
    expect(spot()).toHaveAttribute('aria-invalid', 'true')
  })

  it('leaving one field does not show the message of another untouched invalid field', async () => {
    renderForm({ view: RICH })
    setField(spot(), '')
    setField(futures(), '')
    blur(spot())
    await settle()
    expect(screen.getAllByText(MSG_QTY)).toHaveLength(1)
    expect(futures()).not.toHaveAttribute('aria-invalid')
  })

  it('clears the message once the server accepts the quantity again', async () => {
    renderForm({ view: RICH })
    setField(spot(), '10000')
    blur(spot())
    await settle()
    expect(screen.getByText(MSG_QTY)).toBeInTheDocument()
    setField(spot(), '50')
    await settle()
    expect(screen.queryByText(MSG_QTY)).toBeNull()
    expect(submitBtn()).toBeEnabled()
  })

  it('does not call onSubmit while a quantity is invalid; the press shows every message and focuses the first invalid field', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm({ view: RICH })
    setField(spot(), '')
    setField(futures(), '10000')
    await settle()
    expect(screen.queryByText(MSG_QTY)).toBeNull()
    await user.click(submitBtn())
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getAllByText(MSG_QTY)).toHaveLength(2)
    expect(spot()).toHaveFocus()
  })

  it('a valid decision is still submitted by the press', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm({ view: RICH })
    await settle()
    await user.click(submitBtn())
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('the touched fields and the press reset with a new day', async () => {
    const user = userEvent.setup()
    const { rerenderForm } = renderForm({ view: RICH })
    setField(spot(), '')
    await settle()
    await user.click(submitBtn())
    expect(screen.getByText(MSG_QTY)).toBeInTheDocument()
    rerenderForm({ initialDecision: makePrefill({ day: 6, order_spot: null as unknown as number }) })
    await settle()
    expect(screen.queryByText(MSG_QTY)).toBeNull()
    expect(spot()).not.toHaveAttribute('aria-invalid')
  })
})

describe('closed windows (acceptance criterion 6)', () => {
  it("a closed spot window disables the field at 0 and shows the server's message verbatim", () => {
    renderForm({
      view: makeView({ order_windows: { spot_open: false, spot_message: 'Server says: spot is shut (test copy 1)' } }),
      initialDecision: makePrefill({ order_spot: 0 }),
    })
    expect(spot()).toBeDisabled()
    expect(spot().value).toBe('0')
    expect(cardHas('Server says: spot is shut (test copy 1)')).toBe(true)
    // the open-window context is replaced, not appended
    expect(cardHas('arrives day 6')).toBe(false)
  })

  it("a closed futures window disables the field at 0 and shows the server's message verbatim", () => {
    renderForm({
      view: makeView({
        order_windows: { futures_open: false, futures_days_left_to_buy: 0, futures_message: 'Server says: futures are shut (test copy 2)' },
      }),
      initialDecision: makePrefill({ order_futures: 0 }),
    })
    expect(futures()).toBeDisabled()
    expect(futures().value).toBe('0')
    expect(cardHas('Server says: futures are shut (test copy 2)')).toBe(true)
    expect(spot()).toBeEnabled()
  })

  it('a closed window never blocks Submit day', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm({
      view: makeView({ order_windows: { spot_open: false, futures_open: false, spot_message: 'a', futures_message: 'b' } }),
      initialDecision: makePrefill({ order_spot: 0, order_futures: 0 }),
    })
    await user.click(submitBtn())
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ order_spot: 0, order_futures: 0 })
  })
})

describe('locked form (acceptance criterion 5)', () => {
  it('makes every control read-only, shows Submitted, and swaps the outlay row for lockedFooter', () => {
    renderForm({ locked: true, lockedFooter: <p>Waiting for the others</p> })
    const inert = (el: HTMLElement) =>
      (el as HTMLInputElement).disabled || el.hasAttribute('readonly') || el.getAttribute('aria-disabled') === 'true'
    expect(inert(spot())).toBe(true)
    expect(inert(futures())).toBe(true)
    expect(inert(lotBox('L3'))).toBe(true)
    expect(inert(radio('EXW'))).toBe(true)
    expect(inert(screen.getByRole('switch', { name: 'Vote for equal supply' }))).toBe(true)
    expect(inert(buyBox())).toBe(true)
    expect(inert(sellBox())).toBe(true)
    expect(within(card()).getByText('Submitted')).toBeInTheDocument()
    expect(screen.getByText('Waiting for the others')).toBeInTheDocument()
    const btn = screen.queryByRole('button', { name: 'Submit day' })
    if (btn) expect(btn).toBeDisabled()
    expect(screen.queryByText(/Today:/)).toBeNull()
  })

  it('does not show Submitted or lockedFooter when not locked', () => {
    renderForm({ lockedFooter: <p>Waiting for the others</p> })
    expect(screen.queryByText('Submitted')).toBeNull()
    expect(screen.queryByText('Waiting for the others')).toBeNull()
  })

  it('a locked form cannot be submitted', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm({ locked: true })
    const btn = screen.queryByRole('button', { name: 'Submit day' })
    if (btn) await user.click(btn)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('conserve rows (acceptance criteria 10 and 14)', () => {
  it('shows each lot with its quality, a risk of 100 - quality and its cost', () => {
    renderForm()
    const l3 = lotBox('L3').closest('label')!
    const l4 = lotBox('L4').closest('label')!
    expect(squash(l3.textContent)).toContain(squash('Lot #3 · 12 units · 0%'))
    expect(squash(l3.textContent)).toContain('100%')
    expect(squash(l3.textContent)).toContain('$12.00')
    expect(squash(l4.textContent)).toContain(squash('Lot #4 · 30 units · 23%'))
    expect(squash(l4.textContent)).toContain('77%')
    expect(squash(l4.textContent)).toContain('$30.00')
  })

  it('failure mode 13: a lot at quality 13 with risk_tonight 0.875 shows 87%, not 88%', () => {
    renderForm({ view: makeView({ cellar: [lot('L7', 4, 13, { risk_tonight: 0.875 })] }) })
    const row = lotBox('L7').closest('label')!
    expect(squash(row.textContent)).toContain(squash('Lot #7 · 4 units · 13%'))
    expect(row.textContent).toContain('87%')
    expect(row.textContent).not.toContain('88%')
  })

  it('a conserved lot cannot be ticked, carries the Conserved chip and is never submitted', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm({ view: makeView({ cellar: [lot('L3', 12, 0, { conserved: true }), lot('L4', 30, 23)] }) })
    const box = lotBox('L3')
    expect(box).toBeDisabled()
    expect(box).not.toBeChecked()
    expect(within(box.closest('label')!).getByText('Conserved')).toBeInTheDocument()
    expect(within(lotBox('L4').closest('label')!).queryByText('Conserved')).toBeNull()
    await user.click(box)
    expect(box).not.toBeChecked()
    await user.click(submitBtn())
    expect(onSubmit.mock.calls[0][0].conserve_lots).toEqual([])
  })

  it('an empty cellar shows the empty line and submits no lots', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm({ view: makeView({ cellar: [] }) })
    expect(screen.getByText('Nothing in the cellar to conserve.')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /^L\d/ })).toBeNull()
    await user.click(submitBtn())
    expect(onSubmit.mock.calls[0][0].conserve_lots).toEqual([])
  })

  it('ticking a lot adds its cost to the outlay and unticking removes it', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(lotBox('L4'))
    await eventually('Today: $928.00 of $6,120.00')
    expect(server.preview.mock.lastCall?.[1]).toMatchObject({ conserve_lots: ['L4'] })
    await user.click(lotBox('L4'))
    await eventually('Today: $898.00 of $6,120.00')
  })
})

describe('conserve list: three lots, then Show all (spec 13.7)', () => {
  const five = () => [lot('L1', 5, 10), lot('L2', 6, 20), lot('L3', 12, 0), lot('L4', 30, 23), lot('L5', 8, 90)]
  const toggle = (name: RegExp | string) => within(card()).getByRole('button', { name })

  it('lists only the first three lots in cellar order, with Show all naming the count', () => {
    renderForm({ view: makeView({ cellar: five() }) })
    expect(lotBox('L1')).toBeInTheDocument()
    expect(lotBox('L2')).toBeInTheDocument()
    expect(lotBox('L3')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /^Lot #4 ·/ })).toBeNull()
    expect(screen.queryByRole('checkbox', { name: /^Lot #5 ·/ })).toBeNull()
    expect(toggle('Show all 5 lots')).toHaveAttribute('aria-expanded', 'false')
  })

  it('Show all lists every lot and becomes Hide; Hide goes back to three', async () => {
    const user = userEvent.setup()
    renderForm({ view: makeView({ cellar: five() }) })
    await user.click(toggle('Show all 5 lots'))
    expect(lotBox('L4')).toBeInTheDocument()
    expect(lotBox('L5')).toBeInTheDocument()
    expect(toggle('Hide')).toHaveAttribute('aria-expanded', 'true')
    await user.click(toggle('Hide'))
    expect(screen.queryByRole('checkbox', { name: /^Lot #4 ·/ })).toBeNull()
    expect(toggle('Show all 5 lots')).toBeInTheDocument()
  })

  it('a lot ticked and then hidden is still conserved and still costs', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm({ view: makeView({ cellar: five() }), initialDecision: makePrefill({ order_spot: 0, order_futures: 0 }) })
    await user.click(toggle('Show all 5 lots'))
    await user.click(lotBox('L5'))
    await user.click(toggle('Hide'))
    await eventually('Today: $8.00 of $6,120.00')
    await user.click(submitBtn())
    expect(onSubmit.mock.calls[0][0].conserve_lots).toEqual(['L5'])
  })

  it('has no toggle with three lots or fewer', () => {
    renderForm({ view: makeView({ cellar: five().slice(0, 3) }) })
    expect(within(card()).queryByRole('button', { name: /Show all/ })).toBeNull()
  })

  it('the toggle still works on a locked form', async () => {
    const user = userEvent.setup()
    renderForm({ view: makeView({ cellar: five() }), locked: true })
    await user.click(toggle('Show all 5 lots'))
    expect(lotBox('L5')).toBeInTheDocument()
  })
})

describe('no abbreviations on the decision card (spec 13.7)', () => {
  it('names lots "Lot #n", spells units out, and spells weekdays out', () => {
    renderForm()
    const text = card().textContent ?? ''
    expect(text).toContain('Lot #3 · 12 units · 0%')
    expect(text).not.toMatch(/\bL\d/)
    expect(text).not.toMatch(/\d u\b/)
    expect(text).not.toMatch(/\/u\b/)
    expect(text).not.toMatch(/\((Mon|Tue|Wed|Thu|Fri|Sat|Sun)\)/)
    expect(text).toContain('Fee $0.55/unit')
  })

  it('uses the row names Buy from Supplier, Buy from Players, Shipping insurance, Sell to Players and Equal Supply', () => {
    renderForm()
    for (const name of ['Buy from Supplier', 'Buy from Players', 'Shipping insurance', 'Sell to Players', 'Equal Supply']) {
      expect(within(card()).getAllByText(name).length).toBeGreaterThan(0)
    }
    for (const old of ['Spot', 'If short', 'Ship', 'Sell']) expect(within(card()).queryByText(old)).toBeNull()
  })
})

