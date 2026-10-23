/**
 * Section 26 - the tier choice (ShipSection) and each tier's details tooltip (spec 6.3).
 * Acceptance criteria 7 and 8; failure modes 6 and 7.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import DecisionForm from '../components/game/DecisionForm'
import InTransit from '../components/game/InTransit'
import type { Decision, IncotermTierPlan, PlayerView, PublicConfig, QualityGuideRow } from '../types/game'

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

/** The server's card labels (spec §6.3), as `tier_plans` carries them. */
const LABEL = {
  exw: 'No insurance — you carry the risk',
  cip: 'Paid-price insurance — refund what you paid',
  dap: 'Market-price insurance — refund at the arrival-day spot price',
  ddp: 'Retail-price insurance — refund at the retail price',
}

function makePlans(disabled: string[] = []) {
  const all = [
    { tier: 'exw', label: LABEL.exw, enabled: true, refund_basis: 'none', refund_value_today: null, fee_per_unit: 0 },
    { tier: 'cip', label: LABEL.cip, enabled: true, refund_basis: 'paid', refund_value_today: 13.4, fee_per_unit: 0.55 },
    { tier: 'dap', label: LABEL.dap, enabled: true, refund_basis: 'arrival_spot', refund_value_today: null, fee_per_unit: 0.55 },
    { tier: 'ddp', label: LABEL.ddp, enabled: true, refund_basis: 'retail', refund_value_today: 30, fee_per_unit: 1.39 },
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
const spot = () => input('Buy from Supplier')
const submitBtn = () => screen.getByRole('button', { name: 'Submit day' })
const setField = (el: HTMLElement, v: string | number) => fireEvent.change(el, { target: { value: String(v) } })

const radio = (label: string) => screen.getByRole('radio', { name: new RegExp(`^${label}`) })
const optionText = (label: string) => squash(radio(label).closest('label')!.textContent)

/** Focuses the named info button and returns its open tooltip's text. */
function tipText(name: string): string {
  const button = screen.getByRole('button', { name: `About ${name}` })
  act(() => button.focus())
  return squash(screen.getByRole('tooltip').textContent)
}

describe('tier options (acceptance criterion 7)', () => {
  it('offers one radio per enabled plan, labelled with the plan label', () => {
    renderForm()
    expect(screen.getAllByRole('radio')).toHaveLength(4)
    for (const label of ['No insurance', 'Paid-price insurance', 'Market-price insurance', 'Retail-price insurance']) {
      expect(radio(label)).toBeInTheDocument()
    }
  })

  it('failure mode 7: a plan with enabled false is not offered as a radio', () => {
    renderForm({ view: makeView({ plans: makePlans(['ddp']) }) })
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.queryByRole('radio', { name: /^Retail-price insurance/ })).toBeNull()
    expect(screen.queryByRole('button', { name: `About ${LABEL.ddp} details` })).toBeNull()
    expect(radio('No insurance')).toBeInTheDocument()
    expect(radio('Paid-price insurance')).toBeInTheDocument()
    expect(radio('Market-price insurance')).toBeInTheDocument()
  })

  it('failure mode 7: several disabled plans are all left out, and No insurance alone is offered when only it is enabled', () => {
    renderForm({ view: makeView({ plans: makePlans(['cip', 'dap', 'ddp']) }) })
    expect(screen.getAllByRole('radio')).toHaveLength(1)
    expect(radio('No insurance')).toBeChecked()
  })

  it('each card shows its fee only; the refund is in its tooltip', () => {
    renderForm()
    expect(optionText('No insurance')).toBe(squash(`${LABEL.exw}Fee $0.00/unit`))
    expect(optionText('Paid-price insurance')).toBe(squash(`${LABEL.cip}Fee $0.55/unit`))
    expect(optionText('Market-price insurance')).toBe(squash(`${LABEL.dap}Fee $0.55/unit`))
    expect(optionText('Retail-price insurance')).toBe(squash(`${LABEL.ddp}Fee $1.39/unit`))
    expect(cardHas('Refund')).toBe(false)
  })

  it("takes the fee and the refund value from the view's plans, not from constants", () => {
    const plans = makePlans().map((p) => (p.tier === 'cip' ? { ...p, fee_per_unit: 0.6, refund_value_today: 14.25 } : p))
    renderForm({ view: makeView({ plans }) })
    expect(optionText('Paid-price insurance')).toContain(squash('Fee $0.60/unit'))
    expect(tipText(`${LABEL.cip} details`)).toContain(squash('Refund per lost unit: $14.25'))
  })

  it('selecting a card changes the tier that is submitted', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()
    await user.click(radio('Retail-price insurance'))
    expect(radio('Retail-price insurance')).toBeChecked()
    expect(radio('Paid-price insurance')).not.toBeChecked()
    await user.click(submitBtn())
    expect(onSubmit.mock.calls[0][0].incoterm_tier).toBe('ddp')
  })

  it('opening a tier tooltip does not select that tier', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: `About ${LABEL.ddp} details` }))
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    expect(radio('Paid-price insurance')).toBeChecked()
    expect(radio('Retail-price insurance')).not.toBeChecked()
  })

  it('no Plan details panel is left under the cards', () => {
    renderForm()
    expect(screen.queryByText('Plan details')).toBeNull()
    expect(cardHas("Fee for today's shipment")).toBe(false)
  })
})

describe('tier details tooltip (acceptance criterion 8)', () => {
  it('is closed at rest', () => {
    renderForm()
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('opens with what each insurance means', () => {
    renderForm()
    expect(tipText(`${LABEL.exw} details`)).toContain(squash('No insurance: you carry the risk of the whole trip, and a lost unit is gone.'))
    expect(tipText(`${LABEL.cip} details`)).toContain(
      squash('Paid-price insurance: the supplier carries the risk of the trip and refunds a lost unit at what you paid for it.'),
    )
    expect(tipText(`${LABEL.dap} details`)).toContain(
      squash(
        'Market-price insurance: the supplier carries the risk of the trip and refunds a lost unit at the spot price on the day the shipment arrives.',
      ),
    )
    expect(tipText(`${LABEL.ddp} details`)).toContain(
      squash(
        'Retail-price insurance: the supplier carries the risk of the trip and refunds a lost unit at the retail price, so it also covers the sale you lost.',
      ),
    )
  })

  it("the Shipping insurance row's tooltip explains blockchain tracking", () => {
    renderForm()
    expect(tipText('Shipping insurance')).toContain(squash('so the supplier cannot dispute a loss'))
  })

  it('stacks the tier cards one per row, each the full width of the row', () => {
    renderForm()
    const cards = screen.getAllByRole('radio').map((r) => r.closest('label')!.parentElement!)
    const list = cards[0].parentElement!
    expect(cards.every((c) => c.parentElement === list)).toBe(true)
    expect(list.className).toContain('flex-col')
    expect(list.className).not.toMatch(/grid-cols/)
  })

  it('names what each tier refunds, the refund per lost unit, the fee and the shipment estimate', () => {
    renderForm()
    const exw = tipText(`${LABEL.exw} details`)
    expect(exw).toContain(squash('Refunds: Nothing: you carry the risk'))
    expect(exw).toContain(squash('Refund per lost unit: $0.00'))
    expect(exw).toContain(squash("Fee: $0.00/unit · ~$0.00 for today's shipment"))
    const cip = tipText(`${LABEL.cip} details`)
    expect(cip).toContain(squash("Refunds: What you paid: today's spot price for spot units, the base price for futures units"))
    expect(cip).toContain(squash('Refund per lost unit: $13.40'))
    expect(cip).toContain(squash("Fee: $0.55/unit · ~$22.00 for today's shipment"))
    const dap = tipText(`${LABEL.dap} details`)
    expect(dap).toContain(squash('Refunds: The spot price on the arrival day'))
    expect(dap).toContain(squash('Refund per lost unit: Set on the arrival day'))
    const ddp = tipText(`${LABEL.ddp} details`)
    expect(ddp).toContain(squash('Refunds: The retail price'))
    expect(ddp).toContain(squash('Refund per lost unit: $30.00'))
    expect(ddp).toContain(squash("Fee: $1.39/unit · ~$55.60 for today's shipment"))
  })

  it("the shipment estimate follows the form's quantities and the futures due today, not new futures", () => {
    renderForm({
      view: makeView({ futures_book: [{ contract_day: 0, ships_day: 5, delivery_day: 6, qty: 10 }] }),
      initialDecision: makePrefill({ order_futures: 500 }),
    })
    // 0.55 x (40 + 10); 500 new futures do not ship today
    expect(tipText(`${LABEL.cip} details`)).toContain(squash("~$27.50 for today's shipment"))
    expect(tipText(`${LABEL.ddp} details`)).toContain(squash("~$69.50 for today's shipment"))
    setField(spot(), 0)
    // shipmentMax = 10
    expect(tipText(`${LABEL.cip} details`)).toContain(squash("~$5.50 for today's shipment"))
  })

  it("the Ship row's tooltip says Market-price insurance's refund swings with the market and Paid-price insurance's is fixed", () => {
    renderForm()
    expect(tipText('Shipping insurance')).toContain(
      squash("Market-price insurance's refund swings with the market; Paid-price insurance's is fixed at what you paid."),
    )
  })

  it('failure mode 6: shows no failure chance and no expected loss (no "%", "chance" or "probability")', () => {
    renderForm()
    for (const name of ['Shipping insurance', ...Object.values(LABEL).map((label) => `${label} details`)]) {
      const text = tipText(name)
      // the tip is really rendered, so the assertions below cannot pass on an empty tip
      expect(text.length).toBeGreaterThan(10)
      expect(text).not.toContain('%')
      expect(text).not.toMatch(/chance/i)
      expect(text).not.toMatch(/probabilit/i)
      expect(text).not.toMatch(/expectedloss/i)
    }
  })

  it('stays available when the form is locked', () => {
    renderForm({ locked: true })
    expect(screen.getByRole('button', { name: `About ${LABEL.cip} details` })).toBeEnabled()
    expect(tipText(`${LABEL.cip} details`)).toContain(squash('Refund per lost unit: $13.40'))
  })

  it('each in-transit shipment carries its tier tooltip, with the refund basis and no estimate for today', () => {
    render(
      <InTransit
        shipments={[{ shipped_day: 4, arrives_day: 5, qty: 30, lost: 0, incoterm_tier: 'ddp' }]}
        plans={makePlans() as IncotermTierPlan[]}
      />,
    )
    const text = tipText(`${LABEL.ddp} details`)
    expect(text).toContain(squash('Retail-price insurance: the supplier carries the risk of the trip'))
    expect(text).toContain(squash('Refunds: The retail price'))
    expect(text).not.toContain(squash("today's shipment"))
  })
})
