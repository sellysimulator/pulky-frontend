/**
 * Section 26 - DecisionForm: layout, prefill, outlay, submit, validity, locking,
 * closed windows and the conserve rows.
 * Acceptance criteria 1, 2, 4, 5, 6, 9, 10, 14; failure modes 3, 4, 5, 9, 13.
 * Queries are by role, label or text; copy is only what the spec or the section document quotes.
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import DecisionForm from '../components/game/DecisionForm'


import type { Decision, PlayerView, PublicConfig, QualityGuideRow } from '../types/game'

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
    last_day: 7,
    risk_tonight: (100 - quality) / 100,
    expected_loss_tonight: (qty * (100 - quality)) / 100,
    ...extra,
  }
}

/** Distinct, index-revealing guide rows: last_day = 30 + quality / 5, so a row read by the wrong index differs. */
function makeGuide(): QualityGuideRow[] {
  const rows: QualityGuideRow[] = []
  for (let q = 100; q >= 0; q -= 5) {
    rows.push({ quality: q, half_spoiled_day: q === 0 ? 5 : 6, last_day: q === 0 ? 5 : 30 + q / 5 })
  }
  const r90 = rows.find((r) => r.quality === 90)!
  r90.half_spoiled_day = 7
  r90.last_day = 8
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
    { tier: 'exw', label: 'EXW', enabled: true, refund_basis: 'none', refund_value_today: null, fee_per_unit: 0 },
    { tier: 'cip', label: 'CIP', enabled: true, refund_basis: 'paid', refund_value_today: 13.4, fee_per_unit: 0.4 },
    { tier: 'dap', label: 'DAP', enabled: true, refund_basis: 'arrival_spot', refund_value_today: null, fee_per_unit: 0.4 },
    { tier: 'ddp', label: 'DDP', enabled: true, refund_basis: 'retail', refund_value_today: 30, fee_per_unit: 0.99 },
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
      supplier: { capacity: 81, disrupted: false, disruption_message: null, spot_price: 13.4, base_price: 12, lead_time_days: 1 },
      spot: { open: true, arrives_day: 6 },
      futures: { open: true, price: 12, horizon_days: 7, delivery_day: 12, last_day_to_buy: 7, days_left_to_buy: 3 },
      transport: { shared: false },
      reputation: { P1: 0.62 },
    },
    yesterday: null,
    cellar: o.cellar ?? [lot('L3', 12, 33), lot('L4', 30, 57)],
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
    insurance_plans: o.plans ?? makePlans(),
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
    incoterm: 'cip',
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
  const utils = render(<DecisionForm {...props} />)
  return {
    ...utils,
    onSubmit: props.onSubmit as ReturnType<typeof vi.fn>,
    rerenderForm: (next: Partial<Props>) => utils.rerender(<DecisionForm {...props} {...next} />),
  }
}

const card = () => screen.getByRole('region', { name: "Today's decision" })
const squash = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, '')
const cardHas = (text: string) => squash(card().textContent).includes(squash(text))
const input = (name: string | RegExp) => screen.getByLabelText(name) as HTMLInputElement
const spot = () => input('Spot')
const futures = () => input('Futures')
const submitBtn = () => screen.getByRole('button', { name: 'Submit day' })
const setField = (el: HTMLElement, v: string | number) => fireEvent.change(el, { target: { value: String(v) } })

const SHORT_TICK = /Buy what the supplier cannot fill from other pulquerías, today/
const SELL_TICK = /Offer units to other pulquerías/
const buyBox = () => screen.getByRole('checkbox', { name: SHORT_TICK })
const sellBox = () => screen.getByRole('checkbox', { name: SELL_TICK })
const buyPrice = () => input(/^up to$/i)
const buyQuality = () => input(/^quality at least$/i)
const sellPrice = () => input(/^at$/i)
const sellQuality = () => input(/^quality up to$/i)
const sellUnits = () => input(/^max$/i)
const lotBox = (id: string) => screen.getByRole('checkbox', { name: new RegExp(`^${id} ·`) })
const radio = (label: string) => screen.getByRole('radio', { name: new RegExp(`^${label}`) })

/** The text an input points at through aria-describedby (the NumberField error line sits there). */
function described(el: HTMLElement): string {
  const ids = (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)
  return ids.map((i) => document.getElementById(i)?.textContent ?? '').join(' ')
}

const MSG_QTY = 'Orders must be whole numbers from 0 to 9,999.'

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
      screen.getByRole('group', { name: 'Ship' }),
      lotBox('L3'),
      lotBox('L4'),
      sellBox(),
      screen.getByRole('switch', { name: 'Cooperate on allocation' }),
      screen.getByText(/Today:/),
      submitBtn(),
    ])
    expect(within(card()).getByText(/Conserving adds 2 nights to a lot's fresh period\./)).toBeInTheDocument()
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
      screen.getByRole('group', { name: 'Ship' }),
      lotBox('L3'),
      lotBox('L4'),
      screen.getByRole('switch', { name: 'Cooperate on allocation' }),
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
    expect(cardHas('at $13.40 · capacity 81 · arrives day 6 (Sat)')).toBe(true)
    expect(cardHas('at $12.00, paid today · delivered day 12 · Futures: 3 days left to buy (delivery in 7 days, at $12.00)')).toBe(true)
  })

  it('bounds the quantity fields at 0..9999', () => {
    renderForm()
    expect(spot()).toHaveAttribute('min', '0')
    expect(spot()).toHaveAttribute('max', '9999')
    expect(futures()).toHaveAttribute('min', '0')
    expect(futures()).toHaveAttribute('max', '9999')
  })
})

describe('state and prefill (acceptance criterion 2)', () => {
  it('on day 1 the zero decision shows zeros, EXW, no conserve ticks and both peer rows unticked', () => {
    renderForm({
      view: makeView({ day: 1 }),
      initialDecision: makePrefill({ day: 1, order_spot: 0, order_futures: 0, incoterm: 'exw', cooperate: false }),
    })
    expect(spot().value).toBe('0')
    expect(futures().value).toBe('0')
    expect(radio('EXW')).toBeChecked()
    expect(lotBox('L3')).not.toBeChecked()
    expect(lotBox('L4')).not.toBeChecked()
    expect(buyBox()).not.toBeChecked()
    expect(sellBox()).not.toBeChecked()
    expect(screen.getByRole('switch', { name: 'Cooperate on allocation' })).toHaveAttribute('aria-checked', 'false')
  })

  it("starts from the server's prefill", () => {
    renderForm()
    expect(spot().value).toBe('40')
    expect(futures().value).toBe('25')
    expect(radio('CIP')).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Cooperate on allocation' })).toHaveAttribute('aria-checked', 'true')
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
      initialDecision: makePrefill({ day: 6, order_spot: 8, order_futures: 3, incoterm: 'exw', cooperate: false }),
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
      initialDecision: makePrefill({ order_spot: 40, order_futures: 99, incoterm: 'cip' }),
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
      initialDecision: makePrefill({ incoterm: 'dap' }),
    })
    expect(radio('EXW')).toBeChecked()
    await user.click(submitBtn())
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0].incoterm).toBe('exw')
  })
})

describe('outlay line and bar (acceptance criterion 4)', () => {
  it('shows Today: total of cash and follows quantities, tier and ticks', async () => {
    const user = userEvent.setup()
    renderForm()
    // 40 x 13.40 + 25 x 12.00 + 40 x (1.00 + 0.40) = 892
    expect(cardHas('Today: $892.00 of $6,120.00')).toBe(true)
    await user.click(lotBox('L3'))
    expect(cardHas('Today: $904.00 of $6,120.00')).toBe(true)
    setField(spot(), 50)
    // 670 + 300 + 70 + 12
    expect(cardHas('Today: $1,052.00 of $6,120.00')).toBe(true)
    await user.click(radio('EXW'))
    // 670 + 300 + 50 + 12
    expect(cardHas('Today: $1,032.00 of $6,120.00')).toBe(true)
    setField(futures(), 0)
    expect(cardHas('Today: $732.00 of $6,120.00')).toBe(true)
  })

  it('counts the fee, but not the transport cost, of the futures due today', () => {
    renderForm({ view: makeView({ futures_book: [{ contract_day: 0, ships_day: 5, delivery_day: 6, qty: 10 }] }) })
    // 892 + 0.40 x 10
    expect(cardHas('Today: $896.00 of $6,120.00')).toBe(true)
  })

  it("shows the labelled fee estimate for today's shipment under the cards", () => {
    renderForm({ view: makeView({ futures_book: [{ contract_day: 0, ships_day: 5, delivery_day: 6, qty: 10 }] }) })
    // fee 0.40 x (40 spot + 10 due) = 20
    expect(cardHas("Fee for today's shipment: ~$20.00")).toBe(true)
  })

  it('failure mode 9: a peer purchase limit adds nothing to the outlay', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(lotBox('L3'))
    await user.click(buyBox())
    setField(buyPrice(), 16)
    setField(buyQuality(), 90)
    expect(cardHas('Today: $904.00 of $6,120.00')).toBe(true)
  })
})

describe('Submit day and affordability (acceptance criteria 5 and 9)', () => {
  async function tickMock(user: ReturnType<typeof userEvent.setup>) {
    await user.click(lotBox('L3'))
  }

  it('failure mode 3: at exactly the cash Submit day is enabled', async () => {
    const user = userEvent.setup()
    renderForm({ view: makeView({ cash: 904 }) })
    await tickMock(user)
    expect(cardHas('Today: $904.00 of $904.00')).toBe(true)
    expect(submitBtn()).toBeEnabled()
  })

  it('a cent above the cash disables Submit day and shows the spec 4.3 line', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm({ view: makeView({ cash: 903.99 }) })
    await tickMock(user)
    expect(submitBtn()).toBeDisabled()
    expect(cardHas("Today's purchases cost $904.00 but you only have $903.99")).toBe(true)
    await user.click(submitBtn())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('the over-cash line is absent while the outlay fits', () => {
    renderForm()
    expect(cardHas("Today's purchases cost")).toBe(false)
  })

  it('failure mode 9: with cash 904 and the mock ticks, adding peer_buy max_price 16 keeps Submit day enabled', async () => {
    const user = userEvent.setup()
    renderForm({ view: makeView({ cash: 904 }) })
    await tickMock(user)
    await user.click(buyBox())
    setField(buyPrice(), 16)
    setField(buyQuality(), 90)
    expect(cardHas('Today: $904.00 of $904.00')).toBe(true)
    expect(submitBtn()).toBeEnabled()
    expect(cardHas("Today's purchases cost")).toBe(false)
  })

  it('with cash <= 0 only the zero-outlay decision can be submitted', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm({
      view: makeView({ cash: -20, futures_book: [{ contract_day: 0, ships_day: 5, delivery_day: 6, qty: 10 }] }),
      initialDecision: makePrefill({ order_spot: 0, order_futures: 0, incoterm: 'exw', cooperate: false }),
    })
    expect(submitBtn()).toBeEnabled()
    setField(spot(), 1)
    expect(submitBtn()).toBeDisabled()
    setField(spot(), 0)
    expect(submitBtn()).toBeEnabled()
    await user.click(submitBtn())
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('a zero total with cash 0 is submittable, a cent over is not', () => {
    renderForm({
      view: makeView({ cash: 0 }),
      initialDecision: makePrefill({ order_spot: 0, order_futures: 0, incoterm: 'exw', cooperate: false }),
    })
    expect(submitBtn()).toBeEnabled()
    setField(spot(), 1)
    expect(submitBtn()).toBeDisabled()
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
    await user.click(submitBtn())
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      day: 5,
      order_spot: 40,
      order_futures: 25,
      incoterm: 'cip',
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
    expect(sent).toHaveProperty('peer_buy', null)
    expect(sent).toHaveProperty('peer_sell', null)
    expect(sent).toEqual({
      day: 5,
      order_spot: 40,
      order_futures: 25,
      incoterm: 'cip',
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
    await user.click(screen.getByRole('switch', { name: 'Cooperate on allocation' }))
    setField(spot(), 3)
    setField(futures(), 0)
    await user.click(submitBtn())
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      day: 5,
      order_spot: 3,
      order_futures: 0,
      incoterm: 'ddp',
      conserve_lots: ['L3', 'L4'],
      cooperate: false,
    })
  })
})

describe('quantity validity (acceptance criterion 5)', () => {
  it.each([
    ['an empty spot field', () => spot(), ''],
    ['a spot order above 9,999', () => spot(), '10000'],
    ['an empty futures field', () => futures(), ''],
    ['a futures order above 9,999', () => futures(), '10000'],
  ])('%s shows the spec message and disables Submit day', (_name, field, value) => {
    renderForm()
    setField(field(), value)
    expect(screen.getAllByText(MSG_QTY).length).toBeGreaterThan(0)
    expect(described(field())).toContain(MSG_QTY)
    expect(submitBtn()).toBeDisabled()
  })

  it('clears the message and re-enables Submit day once the quantity is valid again', () => {
    renderForm()
    setField(spot(), '10000')
    expect(submitBtn()).toBeDisabled()
    setField(spot(), '50')
    expect(screen.queryByText(MSG_QTY)).toBeNull()
    expect(submitBtn()).toBeEnabled()
  })

  it('does not call onSubmit while a quantity is invalid', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()
    setField(spot(), '')
    await user.click(submitBtn())
    expect(onSubmit).not.toHaveBeenCalled()
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
    expect(cardHas('capacity 81')).toBe(false)
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
    expect(inert(screen.getByRole('switch', { name: 'Cooperate on allocation' }))).toBe(true)
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
    expect(squash(l3.textContent)).toContain(squash('L3 · 12 u · 33%'))
    expect(squash(l3.textContent)).toContain('67%')
    expect(squash(l3.textContent)).toContain('$12.00')
    expect(squash(l4.textContent)).toContain(squash('L4 · 30 u · 57%'))
    expect(squash(l4.textContent)).toContain('43%')
    expect(squash(l4.textContent)).toContain('$30.00')
  })

  it('failure mode 13: a lot at quality 13 with risk_tonight 0.875 shows 87%, not 88%', () => {
    renderForm({ view: makeView({ cellar: [lot('L7', 4, 13, { risk_tonight: 0.875 })] }) })
    const row = lotBox('L7').closest('label')!
    expect(squash(row.textContent)).toContain(squash('L7 · 4 u · 13%'))
    expect(row.textContent).toContain('87%')
    expect(row.textContent).not.toContain('88%')
  })

  it('a conserved lot cannot be ticked, carries the Conserved chip and is never submitted', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm({ view: makeView({ cellar: [lot('L3', 12, 33, { conserved: true }), lot('L4', 30, 57)] }) })
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
    expect(cardHas('Today: $922.00 of $6,120.00')).toBe(true)
    await user.click(lotBox('L4'))
    expect(cardHas('Today: $892.00 of $6,120.00')).toBe(true)
  })
})
