/**
 * Section 26 - the peer rows (If short / Sell), the quality guide and the offer estimate.
 * Acceptance criteria 11, 12, 13, 15; failure modes 10, 11, 12, 14, 15.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import DecisionForm from '../components/game/DecisionForm'
import { formatQualityGuide, QUALITY_GUIDE_NOTE } from '../utils/format'
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
    { tier: 'exw', label: 'No insurance — you carry the risk', enabled: true, refund_basis: 'none', refund_value_today: null, fee_per_unit: 0 },
    { tier: 'cip', label: 'Paid-price insurance — refund what you paid', enabled: true, refund_basis: 'paid', refund_value_today: 13.4, fee_per_unit: 0.55 },
    { tier: 'dap', label: 'Market-price insurance — refund at the arrival-day spot price', enabled: true, refund_basis: 'arrival_spot', refund_value_today: null, fee_per_unit: 0.55 },
    { tier: 'ddp', label: 'Retail-price insurance — refund at the retail price', enabled: true, refund_basis: 'retail', refund_value_today: 30, fee_per_unit: 1.39 },
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

const MSG_PRICE = 'Peer prices must be from $0.01 to $10,000.00, in whole cents.'
const MSG_QUALITY = 'Quality limits must be whole numbers from 0 to 100.'
const MSG_STEP = 'Quality steps by 5: choose 0, 5, 10, … 100.'
const MSG_UNITS = 'You can offer from 1 to 9,999 units.'

const guideRow = (view: PlayerView, quality: number) => view.quality_guide.find((r) => r.quality === quality)!

async function tickBuy(user: ReturnType<typeof userEvent.setup>, price = 16, quality = 90) {
  await user.click(buyBox())
  setField(buyPrice(), price)
  setField(buyQuality(), quality)
}

async function tickSell(user: ReturnType<typeof userEvent.setup>, price = 15, quality = 60, units = 10) {
  await user.click(sellBox())
  setField(sellPrice(), price)
  setField(sellQuality(), quality)
  setField(sellUnits(), units)
}

describe('ticking and unticking (failure mode 10)', () => {
  it('a freshly ticked row starts with empty fields, which are invalid until filled and show nothing meanwhile', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()
    await user.click(buyBox())
    expect(buyPrice().value).toBe('')
    expect(buyQuality().value).toBe('')
    expect(buyPrice()).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByText(MSG_PRICE)).toBeNull()
    expect(screen.queryByText(MSG_QUALITY)).toBeNull()
    await user.click(submitBtn())
    expect(onSubmit).not.toHaveBeenCalled()
    setField(buyPrice(), 16)
    setField(buyQuality(), 90)
    await user.click(submitBtn())
    expect(onSubmit).toHaveBeenCalledTimes(1)
    await user.click(sellBox())
    expect(sellPrice().value).toBe('')
    expect(sellQuality().value).toBe('')
    expect(sellUnits().value).toBe('')
    expect(submitBtn()).toBeEnabled()
  })

  it('failure mode 16: ticking Sell to Players on an empty prefill shows no message until the field is left', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(sellBox())
    expect(screen.queryByText(MSG_PRICE)).toBeNull()
    expect(screen.queryByText(MSG_QUALITY)).toBeNull()
    expect(screen.queryByText(MSG_UNITS)).toBeNull()
    expect(sellPrice()).not.toHaveAttribute('aria-invalid')
    act(() => sellPrice().focus())
    act(() => sellPrice().blur())
    expect(described(sellPrice())).toContain(MSG_PRICE)
    expect(screen.queryByText(MSG_QUALITY)).toBeNull()
    expect(screen.queryByText(MSG_UNITS)).toBeNull()
  })

  it('failure mode 16: ticking Buy from Players on an empty prefill shows no message either', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(buyBox())
    expect(screen.queryByText(MSG_PRICE)).toBeNull()
    expect(screen.queryByText(MSG_QUALITY)).toBeNull()
    blur(buyQuality())
    expect(described(buyQuality())).toContain(MSG_QUALITY)
    expect(screen.queryByText(MSG_PRICE)).toBeNull()
  })

  it('acceptance criterion 16: Submit day with Sell to Players ticked and empty sends nothing, shows all three messages and focuses the at field', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()
    await user.click(sellBox())
    await user.click(submitBtn())
    expect(onSubmit).not.toHaveBeenCalled()
    expect(described(sellPrice())).toContain(MSG_PRICE)
    expect(described(sellQuality())).toContain(MSG_QUALITY)
    expect(described(sellUnits())).toContain(MSG_UNITS)
    expect(sellPrice()).toHaveFocus()
  })

  it('focus goes to the first invalid field in DOM order across the form', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(buyBox())
    await user.click(sellBox())
    setField(buyPrice(), 16)
    await user.click(submitBtn())
    expect(buyQuality()).toHaveFocus()
  })

  it('failure mode 10: after unticking Sell the submitted decision has peer_sell null, not the greyed values', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()
    await tickSell(user)
    await user.click(sellBox())
    expect(sellBox()).not.toBeChecked()
    // the typed values stay on screen so ticking again restores them
    expect(Number(sellPrice().value)).toBe(15)
    expect(Number(sellQuality().value)).toBe(60)
    expect(Number(sellUnits().value)).toBe(10)
    await user.click(submitBtn())
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0]).toHaveProperty('peer_sell', null)
  })

  it('failure mode 10: the same for If short', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()
    await tickBuy(user)
    await user.click(buyBox())
    expect(Number(buyPrice().value)).toBe(16)
    expect(Number(buyQuality().value)).toBe(90)
    await user.click(submitBtn())
    expect(onSubmit.mock.calls[0][0]).toHaveProperty('peer_buy', null)
  })

  it('failure mode 10: a prefilled row, once unticked, submits null; ticked again it sends the prefilled values', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm({
      initialDecision: makePrefill({
        peer_buy: { max_price: 16, min_quality: 90 },
        peer_sell: { price: 15, max_quality: 60, max_units: 10 },
      }),
    })
    await user.click(buyBox())
    await user.click(sellBox())
    await user.click(submitBtn())
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ peer_buy: null, peer_sell: null })

    onSubmit.mockClear()
    await user.click(buyBox())
    await user.click(sellBox())
    await user.click(submitBtn())
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      peer_buy: { max_price: 16, min_quality: 90 },
      peer_sell: { price: 15, max_quality: 60, max_units: 10 },
    })
  })

  it('ticked rows send the typed values as numbers', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()
    await tickBuy(user, 16.25, 85)
    await tickSell(user, 14.5, 55, 7)
    await user.click(submitBtn())
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      peer_buy: { max_price: 16.25, min_quality: 85 },
      peer_sell: { price: 14.5, max_quality: 55, max_units: 7 },
    })
  })

  it('bounds the quality and unit fields', () => {
    renderForm()
    expect(buyQuality()).toHaveAttribute('min', '0')
    expect(buyQuality()).toHaveAttribute('max', '100')
    expect(sellQuality()).toHaveAttribute('min', '0')
    expect(sellQuality()).toHaveAttribute('max', '100')
    expect(sellUnits()).toHaveAttribute('min', '1')
    expect(sellUnits()).toHaveAttribute('max', '9999')
  })
})

describe('peer market off (acceptance criterion 12, failure mode 11)', () => {
  it('failure mode 11: renders neither row, and a stale prefill submits both keys as null', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm({
      config: makeConfig(false),
      initialDecision: makePrefill({
        peer_buy: { max_price: 16, min_quality: 90 },
        peer_sell: { price: 15, max_quality: 60, max_units: 10 },
      }),
    })
    expect(screen.queryByRole('checkbox', { name: SHORT_TICK })).toBeNull()
    expect(screen.queryByRole('checkbox', { name: SELL_TICK })).toBeNull()
    expect(screen.queryByLabelText(/^up to$/i)).toBeNull()
    expect(screen.queryByLabelText(/^max$/i)).toBeNull()
    expect(submitBtn()).toBeEnabled()
    await user.click(submitBtn())
    const sent = onSubmit.mock.calls[0][0]
    expect(sent).toHaveProperty('peer_buy', null)
    expect(sent).toHaveProperty('peer_sell', null)
  })

  it('renders no quality guide', () => {
    renderForm({ config: makeConfig(false) })
    expect(screen.queryByText(QUALITY_GUIDE_NOTE, { exact: false })).toBeNull()
  })
})

describe('If short with spot closed (acceptance criterion 12)', () => {
  const closed = { spot_open: false, spot_message: 'Spot closed (test copy)' }

  it('disables the whole row and explains why', () => {
    renderForm({ view: makeView({ order_windows: closed }), initialDecision: makePrefill({ order_spot: 0 }) })
    expect(buyBox()).toBeDisabled()
    expect(buyPrice()).toBeDisabled()
    expect(buyQuality()).toBeDisabled()
    expect(cardHas('Spot orders are closed, so there is no shortfall to cover.')).toBe(true)
    // Sell is not tied to the spot window
    expect(sellBox()).toBeEnabled()
  })

  it('keeps and sends the prefilled value', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm({
      view: makeView({ order_windows: closed }),
      initialDecision: makePrefill({ order_spot: 0, peer_buy: { max_price: 16, min_quality: 90 } }),
    })
    expect(buyBox()).toBeChecked()
    expect(Number(buyPrice().value)).toBe(16)
    await user.click(submitBtn())
    expect(onSubmit.mock.calls[0][0].peer_buy).toEqual({ max_price: 16, min_quality: 90 })
  })

  it('a null prefill stays null and unticked', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm({ view: makeView({ order_windows: closed }), initialDecision: makePrefill({ order_spot: 0 }) })
    expect(buyBox()).not.toBeChecked()
    await user.click(buyBox())
    expect(buyBox()).not.toBeChecked()
    await user.click(submitBtn())
    expect(onSubmit.mock.calls[0][0].peer_buy).toBeNull()
  })

  it('does not show the closed line while spot is open', () => {
    renderForm()
    expect(cardHas('Spot orders are closed, so there is no shortfall to cover.')).toBe(false)
    expect(buyBox()).toBeEnabled()
  })
})

describe('the quality guide (acceptance criterion 11, failure mode 14)', () => {
  it("shows the guide line for the minimum quality in the spec copy; the note is in the row's tooltip", async () => {
    const user = userEvent.setup()
    renderForm()
    await tickBuy(user, 16, 90)
    expect(cardHas('90%: 10% risk tonight · half spoiled by day 7 · lasts at most 4 days (through day 8)')).toBe(true)
    expect(screen.queryByText(QUALITY_GUIDE_NOTE, { exact: false })).toBeNull()
    expect(tipText('Buy from Players')).toContain(squash(QUALITY_GUIDE_NOTE))
  })

  it('follows the minimum quality as it changes, from the matching row', async () => {
    const user = userEvent.setup()
    const view = makeView()
    renderForm({ view })
    await tickBuy(user, 16, 90)
    setField(buyQuality(), 95)
    expect(cardHas(formatQualityGuide(guideRow(view, 95), 5))).toBe(true)
    expect(cardHas('90%: 10% risk')).toBe(false)
    setField(buyQuality(), 0)
    expect(cardHas(formatQualityGuide(guideRow(view, 0), 5))).toBe(true)
    expect(cardHas('0%: spoils tonight · sell it today')).toBe(true)
  })

  it('failure mode 14: min_quality 85 reads the row whose quality is 85 (not guide[85 / 5], row 0 being 100%)', async () => {
    const user = userEvent.setup()
    const view = makeView()
    renderForm({ view })
    await tickBuy(user, 16, 85)
    const expected = formatQualityGuide(guideRow(view, 85), 5)
    expect(expected.startsWith('85%')).toBe(true)
    expect(cardHas(expected)).toBe(true)
    // the row a wrong index would pick (quality 15, or 100 - 85 read as an index) must not be shown
    expect(cardHas(formatQualityGuide(guideRow(view, 15), 5))).toBe(false)
    expect(cardHas(formatQualityGuide(guideRow(view, 100 - 85 + 0), 5))).toBe(false)
    expect(cardHas('85%:')).toBe(true)
  })

  it('shows nothing while the minimum quality is empty or has no guide row', async () => {
    const user = userEvent.setup()
    renderForm()
    await tickBuy(user, 16, 90)
    setField(buyQuality(), '')
    expect(cardHas('risk tonight')).toBe(false)
    setField(buyQuality(), 101)
    expect(cardHas('risk tonight')).toBe(false)
  })
})

describe('the "now in your cellar" estimate (acceptance criterion 13, failure mode 12)', () => {
  it('counts the lots at or below the maximum quality, capped at max_units', async () => {
    const user = userEvent.setup()
    renderForm()
    await tickSell(user, 15, 60, 10)
    expect(cardHas('now in your cellar: 10 units at 60% or less (Lot #3, Lot #4)')).toBe(true)
    setField(sellUnits(), 99)
    expect(cardHas('now in your cellar: 42 units at 60% or less (Lot #3, Lot #4)')).toBe(true)
  })

  it('counts only lots at or below the limit', async () => {
    const user = userEvent.setup()
    renderForm()
    await tickSell(user, 15, 35, 99)
    expect(cardHas('now in your cellar: 12 units at 35% or less (Lot #3)')).toBe(true)
  })

  it('says so when no lot matches', async () => {
    const user = userEvent.setup()
    renderForm()
    await tickSell(user, 15, 30, 10)
    expect(cardHas('now in your cellar: no lots at 30% or less')).toBe(true)
  })

  it('failure mode 12: ticking L4 to conserve drops it from the line, ticking L3 too leaves no lots', async () => {
    const user = userEvent.setup()
    renderForm()
    await tickSell(user, 15, 60, 99)
    expect(cardHas('now in your cellar: 42 units at 60% or less (Lot #3, Lot #4)')).toBe(true)
    await user.click(lotBox('L4'))
    expect(cardHas('now in your cellar: 12 units at 60% or less (Lot #3)')).toBe(true)
    expect(cardHas('(Lot #3, Lot #4)')).toBe(false)
    await user.click(lotBox('L3'))
    expect(cardHas('now in your cellar: no lots at 60% or less')).toBe(true)
    await user.click(lotBox('L4'))
    // unticking L4 brings it back (L3 stays conserved)
    expect(cardHas('now in your cellar: 30 units at 60% or less (Lot #4)')).toBe(true)
    expect(cardHas('(Lot #3')).toBe(false)
  })

  it("leaves today's retail and spot prices to the Sell row's tooltip", async () => {
    const user = userEvent.setup()
    renderForm()
    await tickSell(user, 15, 60, 10)
    expect(cardHas('retail $30.00')).toBe(false)
    expect(tipText('Sell to Players')).toContain(squash('Today: retail $30.00 · spot $13.40'))
  })

  it('the worked example: 10 units at 60% or less (Lot #4) once Lot #3 is ticked to conserve', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(lotBox('L3'))
    await tickSell(user, 15, 60, 10)
    expect(cardHas('now in your cellar: 10 units at 60% or less (Lot #4)')).toBe(true)
  })
})

describe('peer-field validation (acceptance criterion 15)', () => {
  async function ticked() {
    const user = userEvent.setup()
    const utils = renderForm()
    await tickBuy(user)
    await tickSell(user)
    expect(submitBtn()).toBeEnabled()
    return { user, ...utils }
  }

  it.each([
    ['empty', ''],
    ['zero', '0'],
    ['below one cent', '0.001'],
    ['a fraction of a cent', '15.005'],
    ['above the maximum', '10000.01'],
  ])('a buy price that is %s shows the peer-price message under its field once left, and Submit day stays enabled', async (_n, value) => {
    await ticked()
    setField(buyPrice(), value)
    blur(buyPrice())
    expect(described(buyPrice())).toContain(MSG_PRICE)
    expect(buyPrice()).toHaveAttribute('aria-invalid', 'true')
    expect(described(buyQuality())).not.toContain(MSG_PRICE)
    expect(described(sellPrice())).not.toContain(MSG_PRICE)
    expect(submitBtn()).toBeEnabled()
  })

  it.each([
    ['empty', ''],
    ['zero', '0'],
    ['a fraction of a cent', '15.005'],
    ['above the maximum', '10000.01'],
  ])('a sell price that is %s shows the peer-price message under its field once left, and Submit day stays enabled', async (_n, value) => {
    await ticked()
    setField(sellPrice(), value)
    blur(sellPrice())
    expect(described(sellPrice())).toContain(MSG_PRICE)
    expect(described(buyPrice())).not.toContain(MSG_PRICE)
    expect(submitBtn()).toBeEnabled()
  })

  it.each(['0.01', '15', '15.1', '15.99', '10000'])('a price of %s is accepted', async (value) => {
    await ticked()
    setField(buyPrice(), value)
    setField(sellPrice(), value)
    expect(screen.queryByText(MSG_PRICE)).toBeNull()
    expect(submitBtn()).toBeEnabled()
  })

  it('failure mode 15: a peer price of 15.005 is refused with the message, never rounded to 15.01 and sent', async () => {
    const { user, onSubmit } = await ticked()
    setField(buyPrice(), '15.005')
    blur(buyPrice())
    expect(screen.getByText(MSG_PRICE)).toBeInTheDocument()
    expect(submitBtn()).toBeEnabled()
    await user.click(submitBtn())
    expect(onSubmit).not.toHaveBeenCalled()
    // the same for the sell price
    setField(buyPrice(), '16')
    setField(sellPrice(), '15.005')
    blur(sellPrice())
    expect(screen.getByText(MSG_PRICE)).toBeInTheDocument()
    await user.click(submitBtn())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it.each([
    ['empty', '', MSG_QUALITY],
    ['above 100', '101', MSG_QUALITY],
    ['not a multiple of 5', '92', MSG_STEP],
    ['not a multiple of 5 (1)', '1', MSG_STEP],
  ])('a minimum quality that is %s shows its message under its field once left, and Submit day stays enabled', async (_n, value, message) => {
    await ticked()
    setField(buyQuality(), value)
    blur(buyQuality())
    expect(described(buyQuality())).toContain(message)
    expect(described(buyPrice())).not.toContain(message)
    expect(submitBtn()).toBeEnabled()
  })

  it.each([
    ['empty', '', MSG_QUALITY],
    ['above 100', '150', MSG_QUALITY],
    ['not a multiple of 5', '63', MSG_STEP],
  ])('a maximum quality that is %s shows its message under its field once left, and Submit day stays enabled', async (_n, value, message) => {
    await ticked()
    setField(sellQuality(), value)
    blur(sellQuality())
    expect(described(sellQuality())).toContain(message)
    expect(described(sellPrice())).not.toContain(message)
    expect(submitBtn()).toBeEnabled()
  })

  it.each(['0', '5', '95', '100'])('a quality of %s is accepted', async (value) => {
    await ticked()
    setField(buyQuality(), value)
    setField(sellQuality(), value)
    expect(screen.queryByText(MSG_QUALITY)).toBeNull()
    expect(screen.queryByText(MSG_STEP)).toBeNull()
    expect(submitBtn()).toBeEnabled()
  })

  it.each([
    ['empty', ''],
    ['zero', '0'],
    ['above 9,999', '10000'],
  ])('max units that is %s shows the offer-units message under its field once left, and Submit day stays enabled', async (_n, value) => {
    await ticked()
    setField(sellUnits(), value)
    blur(sellUnits())
    expect(described(sellUnits())).toContain(MSG_UNITS)
    expect(submitBtn()).toBeEnabled()
  })

  it.each(['1', '9999'])('max units of %s is accepted', async (value) => {
    await ticked()
    setField(sellUnits(), value)
    expect(screen.queryByText(MSG_UNITS)).toBeNull()
    expect(submitBtn()).toBeEnabled()
  })

  it('an unticked row with an invalid typed value does not block the day, and is not validated', async () => {
    const { user, onSubmit } = await ticked()
    setField(buyPrice(), '15.005')
    setField(buyQuality(), '92')
    setField(sellPrice(), '')
    setField(sellUnits(), '0')
    blur(buyPrice())
    expect(described(buyPrice())).toContain(MSG_PRICE)
    await user.click(submitBtn())
    expect(onSubmit).not.toHaveBeenCalled()
    await user.click(buyBox())
    await user.click(sellBox())
    expect(screen.queryByText(MSG_PRICE)).toBeNull()
    expect(screen.queryByText(MSG_STEP)).toBeNull()
    expect(screen.queryByText(MSG_UNITS)).toBeNull()
    expect(submitBtn()).toBeEnabled()
    await user.click(submitBtn())
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ peer_buy: null, peer_sell: null })
  })

  it('ticking an invalid row again blocks the day again', async () => {
    const { user, onSubmit } = await ticked()
    setField(sellPrice(), '15.005')
    await user.click(sellBox())
    await user.click(sellBox())
    await user.click(submitBtn())
    expect(onSubmit).not.toHaveBeenCalled()
    expect(described(sellPrice())).toContain(MSG_PRICE)
  })
})
