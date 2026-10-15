/**
 * Section 26 - the tier choice (ShipSection) and the Plan details panel (spec 6.3).
 * Acceptance criteria 7 and 8; failure modes 6 and 7.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import DecisionForm from '../components/game/DecisionForm'
import { getUiFlag, setUiFlag } from '../utils/storage'
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
const submitBtn = () => screen.getByRole('button', { name: 'Submit day' })
const setField = (el: HTMLElement, v: string | number) => fireEvent.change(el, { target: { value: String(v) } })

const radio = (label: string) => screen.getByRole('radio', { name: new RegExp(`^${label}`) })


const planDetails = () => screen.getByText('Plan details').closest('details') as HTMLDetailsElement
const detailsText = () => squash(planDetails().textContent)
const optionText = (label: string) => squash(radio(label).closest('label')!.textContent)

describe('tier options (acceptance criterion 7)', () => {
  it('offers one radio per enabled plan, labelled with the plan label', () => {
    renderForm()
    expect(screen.getAllByRole('radio')).toHaveLength(4)
    for (const label of ['EXW', 'CIP', 'DAP', 'DDP']) expect(radio(label)).toBeInTheDocument()
  })

  it('failure mode 7: a plan with enabled false is not offered as a radio', () => {
    renderForm({ view: makeView({ plans: makePlans(['ddp']) }) })
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.queryByRole('radio', { name: /^DDP/ })).toBeNull()
    expect(radio('EXW')).toBeInTheDocument()
    expect(radio('CIP')).toBeInTheDocument()
    expect(radio('DAP')).toBeInTheDocument()
  })

  it('failure mode 7: several disabled plans are all left out, and EXW alone is offered when only it is enabled', () => {
    renderForm({ view: makeView({ plans: makePlans(['cip', 'dap', 'ddp']) }) })
    expect(screen.getAllByRole('radio')).toHaveLength(1)
    expect(radio('EXW')).toBeChecked()
  })

  it('each option shows its fee and its refund line', () => {
    renderForm()
    expect(optionText('EXW')).toContain(squash('Fee $0.00/u'))
    expect(optionText('EXW')).toContain(squash('No refund'))
    expect(optionText('CIP')).toContain(squash('Fee $0.40/u'))
    expect(optionText('CIP')).toContain(squash('Refund $13.40/u lost'))
    expect(optionText('DAP')).toContain(squash('Fee $0.40/u'))
    expect(optionText('DAP')).toContain(squash("Refund at the arrival day's spot price"))
    expect(optionText('DDP')).toContain(squash('Fee $0.99/u'))
    expect(optionText('DDP')).toContain(squash('Refund $30.00/u lost'))
  })

  it("takes the fee and the refund value from the view's plans, not from constants", () => {
    const plans = makePlans().map((p) =>
      p.tier === 'cip' ? { ...p, fee_per_unit: 0.55, refund_value_today: 14.25 } : p,
    )
    renderForm({ view: makeView({ plans }) })
    expect(optionText('CIP')).toContain(squash('Fee $0.55/u'))
    expect(optionText('CIP')).toContain(squash('Refund $14.25/u lost'))
  })

  it('selecting a card changes the tier that is submitted and the fee estimate line', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()
    expect(cardHas("Fee for today's shipment: ~$16.00")).toBe(true)
    await user.click(radio('DDP'))
    expect(radio('DDP')).toBeChecked()
    expect(radio('CIP')).not.toBeChecked()
    expect(cardHas("Fee for today's shipment: ~$39.60")).toBe(true)
    await user.click(submitBtn())
    expect(onSubmit.mock.calls[0][0].incoterm).toBe('ddp')
  })

  it('the fee estimate counts the futures due today and ignores new futures', () => {
    renderForm({
      view: makeView({ futures_book: [{ contract_day: 0, ships_day: 5, delivery_day: 6, qty: 10 }] }),
      initialDecision: makePrefill({ order_futures: 500 }),
    })
    // 0.40 x (40 + 10); 500 new futures do not ship today
    expect(cardHas("Fee for today's shipment: ~$20.00")).toBe(true)
  })
})

describe('Plan details (acceptance criterion 8)', () => {
  it('is closed by default', () => {
    renderForm()
    expect(planDetails().tagName).toBe('DETAILS')
    expect(planDetails().open).toBe(false)
    expect(planDetails().querySelector('summary')).toHaveTextContent('Plan details')
  })

  it('remembers its state through setUiFlag: clicking opens it and stores the flag, clicking again closes it', async () => {
    const user = userEvent.setup()
    renderForm()
    expect(getUiFlag('plan_details_open')).toBe(false)
    await user.click(screen.getByText('Plan details'))
    expect(getUiFlag('plan_details_open')).toBe(true)
    expect(planDetails().open).toBe(true)
    await user.click(screen.getByText('Plan details'))
    expect(getUiFlag('plan_details_open')).toBe(false)
    expect(planDetails().open).toBe(false)
  })

  it('starts open when the stored flag says so', () => {
    setUiFlag('plan_details_open', true)
    renderForm()
    expect(planDetails().open).toBe(true)
  })

  it('has one row per enabled plan: label, refund basis in words, refund per lost unit, fee and shipment estimate', () => {
    renderForm()
    const text = detailsText()
    for (const label of ['EXW', 'CIP', 'DAP', 'DDP']) expect(text).toContain(label)
    expect(text).toContain(squash('Refunds:'))
    expect(text).toContain(squash('Nothing: you carry the risk'))
    expect(text).toContain(squash("What you paid: today's spot price for spot units, the base price for futures units"))
    expect(text).toContain(squash('The spot price on the arrival day'))
    expect(text).toContain(squash('The retail price'))
    expect(text).toContain(squash('Refund per lost unit:'))
    expect(text).toContain(squash('$0.00'))
    expect(text).toContain(squash('$13.40'))
    expect(text).toContain(squash('Set on the arrival day'))
    expect(text).toContain(squash('$30.00'))
    expect(text).toContain(squash('Fee:'))
    expect(text).toContain(squash('$0.40/u'))
    expect(text).toContain(squash('$0.99/u'))
    expect(text).toContain(squash("~$16.00 for today's shipment"))
    expect(text).toContain(squash("~$39.60 for today's shipment"))
    expect(text).toContain(squash("~$0.00 for today's shipment"))
  })

  it("the shipment estimate follows the form's quantities and the futures due today", () => {
    renderForm({ view: makeView({ futures_book: [{ contract_day: 0, ships_day: 5, delivery_day: 6, qty: 10 }] }) })
    // shipmentMax = 40 + 10 = 50
    expect(detailsText()).toContain(squash("~$20.00 for today's shipment"))
    expect(detailsText()).toContain(squash("~$49.50 for today's shipment"))
    setField(spot(), 0)
    // shipmentMax = 10
    expect(detailsText()).toContain(squash("~$4.00 for today's shipment"))
    expect(detailsText()).toContain(squash("~$9.90 for today's shipment"))
  })

  it("ends with the sentence on DAP's and CIP's refunds", () => {
    renderForm()
    expect(detailsText()).toContain(squash("DAP's refund swings with the market; CIP's is fixed at what you paid."))
  })

  it('lists only the enabled plans', () => {
    renderForm({ view: makeView({ plans: makePlans(['ddp']) }) })
    expect(detailsText()).not.toContain('DDP')
    expect(detailsText()).not.toContain('$30.00')
    expect(detailsText()).toContain('CIP')
  })

  it('failure mode 6: shows no failure chance and no expected loss (no "%", "chance" or "probability")', () => {
    renderForm()
    const text = planDetails().textContent ?? ''
    // the panel is really rendered, so the assertions below cannot pass on an empty panel
    expect(text).toContain('Refunds:')
    expect(text).toContain('Fee:')
    expect(text).not.toContain('%')
    expect(text).not.toMatch(/chance/i)
    expect(text).not.toMatch(/probabilit/i)
    expect(text).not.toMatch(/expected loss/i)
  })

  it('stays available when the form is locked: it can still be opened, and it still lists the plans', async () => {
    const user = userEvent.setup()
    renderForm({ locked: true })
    expect(planDetails().open).toBe(false)
    await user.click(screen.getByText('Plan details'))
    expect(planDetails().open).toBe(true)
    expect(getUiFlag('plan_details_open')).toBe(true)
    expect(detailsText()).toContain(squash('Refund per lost unit:'))
    expect(detailsText()).toContain('CIP')
  })
})
