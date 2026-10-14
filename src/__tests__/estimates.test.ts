/**
 * Section 26 - `src/game/estimates.ts` (the labelled estimates of spec 12.4).
 * Acceptance criterion 3 and failure modes 1, 2, 3, 8 and 9; the worked
 * examples of the section document, section 4.
 */
import { describe, expect, it } from 'vitest'
import {
  canAfford,
  conservationCost,
  futuresDueToday,
  isWholeCents,
  outlayEstimate,
  tierFee,
  unitsOnOffer,
  type DecisionDraft,
} from '../game/estimates'
import type { PlayerView, PublicConfig } from '../types/game'

interface Overrides {
  futures_book?: Array<{ contract_day: number; ships_day: number; delivery_day: number; qty: number }>
  cellar?: Array<Record<string, unknown>>
  spot_price?: number
  base_price?: number
}

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

/** The spec 13.7 mock, day 5. */
function makeView(o: Overrides = {}): PlayerView {
  const view = {
    alias: 'P1',
    display_name: 'Don Agave',
    day: 5,
    duration_days: 14,
    weekday: 'fri',
    phase: 'deciding',
    has_submitted: false,
    awaiting: [],
    brief: {
      day: 5,
      duration_days: 14,
      weekday: 'fri',
      weekday_multiplier: 1,
      weekday_multipliers: { mon: 0.25, tue: 0.5, wed: 0.75, thu: 1, fri: 1, sat: 1, sun: 0.75 },
      expected_demand: 100,
      supplier: {
        capacity: 81,
        disrupted: false,
        disruption_message: null,
        spot_price: o.spot_price ?? 13.4,
        base_price: o.base_price ?? 12,
        lead_time_days: 1,
      },
      spot: { open: true, arrives_day: 6 },
      futures: { open: true, price: o.base_price ?? 12, horizon_days: 7, delivery_day: 12, last_day_to_buy: 7, days_left_to_buy: 3 },
      transport: { shared: false },
      reputation: { P1: 0.62 },
    },
    yesterday: null,
    cellar: o.cellar ?? [lot('L3', 12, 33), lot('L4', 30, 57)],
    stock_by_age: [],
    quality_guide: [],
    expected_spoil_tonight: 0,
    in_transit: [],
    futures_book: o.futures_book ?? [],
    backlog: 0,
    expected_demand_own: 27,
    reputation: 0.62,
    market_share: 0.25,
    cash: 6120,
    cumulative_profit: 0,
    insurance_plans: [
      { tier: 'exw', label: 'EXW', enabled: true, refund_basis: 'none', refund_value_today: null, fee_per_unit: 0 },
      { tier: 'cip', label: 'CIP', enabled: true, refund_basis: 'paid', refund_value_today: 13.4, fee_per_unit: 0.4 },
      { tier: 'dap', label: 'DAP', enabled: true, refund_basis: 'arrival_spot', refund_value_today: null, fee_per_unit: 0.4 },
      { tier: 'ddp', label: 'DDP', enabled: true, refund_basis: 'retail', refund_value_today: 30, fee_per_unit: 0.99 },
    ],
    order_windows: {
      spot_open: true,
      futures_open: true,
      futures_days_left_to_buy: 3,
      futures_message: 'Futures: 3 days left to buy (delivery in 7 days, at $12.00)',
      spot_message: null,
    },
    prefill_decision: null,
    final_settlement: null,
    full: true,
  }
  return view as unknown as PlayerView
}

function makeConfig(over: { transport?: number; conservation?: number } = {}): PublicConfig {
  return {
    demand: { retail_price: 30 },
    stock: { conservation_extra_fresh_days: 2, conservation_cost_per_unit: over.conservation ?? 1 },
    peer_market: { enabled: true },
    transport: { unit_cost: over.transport ?? 1 },
  }
}

function draft(over: Partial<DecisionDraft> = {}): DecisionDraft {
  return {
    order_spot: 0,
    order_futures: 0,
    incoterm: 'exw',
    conserve_lots: [],
    cooperate: false,
    peer_buy: null,
    peer_sell: null,
    ...over,
  }
}

const MOCK = draft({ order_spot: 40, order_futures: 25, incoterm: 'cip', conserve_lots: ['L3'], cooperate: true })
const DUE_10 = [{ contract_day: 0, ships_day: 5, delivery_day: 6, qty: 10 }]

describe('futuresDueToday', () => {
  it('is 0 with an empty futures book', () => {
    expect(futuresDueToday(makeView())).toBe(0)
  })

  it('sums only the contracts that ship on the view day', () => {
    const view = makeView({
      futures_book: [
        { contract_day: 1, ships_day: 5, delivery_day: 6, qty: 6 },
        { contract_day: 2, ships_day: 5, delivery_day: 6, qty: 4 },
        { contract_day: 3, ships_day: 6, delivery_day: 7, qty: 7 },
        { contract_day: 4, ships_day: 4, delivery_day: 5, qty: 9 },
      ],
    })
    expect(futuresDueToday(view)).toBe(10)
  })
})

describe('tierFee', () => {
  it('is the plan fee_per_unit, and 0 for exw', () => {
    const view = makeView()
    expect(tierFee('exw', view)).toBe(0)
    expect(tierFee('cip', view)).toBeCloseTo(0.4, 10)
    expect(tierFee('dap', view)).toBeCloseTo(0.4, 10)
    expect(tierFee('ddp', view)).toBeCloseTo(0.99, 10)
  })
})

describe('conservationCost', () => {
  it('is the per-unit cost times the quantity of the ticked lots', () => {
    const view = makeView()
    expect(conservationCost([], view, makeConfig())).toBe(0)
    expect(conservationCost(['L3'], view, makeConfig())).toBeCloseTo(12, 10)
    expect(conservationCost(['L4'], view, makeConfig())).toBeCloseTo(30, 10)
    expect(conservationCost(['L3', 'L4'], view, makeConfig())).toBeCloseTo(42, 10)
    expect(conservationCost(['L3', 'L4'], view, makeConfig({ conservation: 2.5 }))).toBeCloseTo(105, 10)
  })
})

describe('outlayEstimate (acceptance criterion 3; spec 8.3)', () => {
  it('matches the worked example: 536 + 300 + 56 + 12 = 904', () => {
    const e = outlayEstimate(MOCK, makeView(), makeConfig())
    expect(e.spot).toBeCloseTo(536, 9)
    expect(e.futures).toBeCloseTo(300, 9)
    expect(e.shipping).toBeCloseTo(56, 9)
    expect(e.conservation).toBeCloseTo(12, 9)
    expect(e.total).toBeCloseTo(904, 9)
    expect(e.shipmentMax).toBe(40)
  })

  it('failure mode 1: 10 futures due today under CIP charge the fee but not the transport -> shipping 60', () => {
    const e = outlayEstimate(MOCK, makeView({ futures_book: DUE_10 }), makeConfig())
    expect(e.shipmentMax).toBe(50)
    // 56 would mean the due units were ignored; 70 would mean transport was charged on them.
    expect(e.shipping).toBeCloseTo(60, 9)
    expect(e.shipping).not.toBeCloseTo(56, 6)
    expect(e.shipping).not.toBeCloseTo(70, 6)
    expect(e.total).toBeCloseTo(908, 9)
  })

  it('failure mode 1: under EXW the futures due today add nothing to shipping (no fee, no transport)', () => {
    const e = outlayEstimate(draft({ order_spot: 40, incoterm: 'exw' }), makeView({ futures_book: DUE_10 }), makeConfig())
    expect(e.shipping).toBeCloseTo(40, 9)
  })

  it('failure mode 2: new futures never ship today, so they do not enter shipmentMax or shipping', () => {
    const view = makeView({ futures_book: DUE_10 })
    const none = outlayEstimate({ ...MOCK, order_futures: 0 }, view, makeConfig())
    const many = outlayEstimate({ ...MOCK, order_futures: 500 }, view, makeConfig())
    expect(many.shipmentMax).toBe(50)
    expect(none.shipmentMax).toBe(50)
    expect(many.shipping).toBeCloseTo(none.shipping, 9)
    expect(many.futures).toBeCloseTo(500 * 12, 9)
  })

  it('failure mode 8: the total is the rounded sum of the unrounded parts (13.41), not the sum of rounded parts (13.42)', () => {
    const view = makeView({ cellar: [lot('L9', 1, 50)] })
    const config = makeConfig({ transport: 0.005, conservation: 0.005 })
    const e = outlayEstimate(draft({ order_spot: 1, incoterm: 'exw', conserve_lots: ['L9'] }), view, config)
    expect(e.shipping).toBeCloseTo(0.01, 9)
    expect(e.conservation).toBeCloseTo(0.01, 9)
    expect(e.spot).toBeCloseTo(13.4, 9)
    expect(e.total).toBeCloseTo(13.41, 9)
    expect(e.total).not.toBeCloseTo(13.42, 6)
  })

  it('failure mode 9: peer limits are ignored, the total stays 904', () => {
    const withPeers = draft({
      ...MOCK,
      peer_buy: { max_price: 16, min_quality: 90 },
      peer_sell: { price: 15, max_quality: 60, max_units: 10 },
    })
    expect(outlayEstimate(withPeers, makeView(), makeConfig())).toEqual(outlayEstimate(MOCK, makeView(), makeConfig()))
    const buyOnly = outlayEstimate({ ...MOCK, peer_buy: { max_price: 16, min_quality: 0 } }, makeView(), makeConfig())
    expect(buyOnly.total).toBeCloseTo(904, 9)
  })

  it('the zero decision costs 0 even with futures due today', () => {
    const e = outlayEstimate(draft(), makeView({ futures_book: DUE_10 }), makeConfig())
    expect(e.total).toBe(0)
    expect(e.spot).toBe(0)
    expect(e.futures).toBe(0)
    expect(e.conservation).toBe(0)
    expect(e.shipping).toBe(0)
  })

  it('uses the prices of the brief (spot_price for spot, base_price for futures)', () => {
    const e = outlayEstimate(draft({ order_spot: 10, order_futures: 10 }), makeView({ spot_price: 20, base_price: 7 }), makeConfig())
    expect(e.spot).toBeCloseTo(200, 9)
    expect(e.futures).toBeCloseTo(70, 9)
  })

  it('exposes whole-cent values in every component', () => {
    const e = outlayEstimate(draft({ order_spot: 3, incoterm: 'dap' }), makeView(), makeConfig({ transport: 0.333 }))
    for (const v of [e.spot, e.futures, e.shipping, e.conservation, e.total]) {
      expect(isWholeCents(v)).toBe(true)
    }
  })
})

describe('canAfford (spec 8.3)', () => {
  it('a zero total is always affordable, whatever the cash', () => {
    expect(canAfford(0, -20)).toBe(true)
    expect(canAfford(0, 0)).toBe(true)
  })

  it('a cent over zero cash is not', () => {
    expect(canAfford(0.01, 0)).toBe(false)
  })

  it('failure mode 3: a total exactly equal to the cash is affordable', () => {
    expect(canAfford(904, 904)).toBe(true)
    expect(canAfford(903.99, 904)).toBe(true)
    expect(canAfford(904.01, 904)).toBe(false)
  })

  it('compares the cents-rounded total with the cash', () => {
    expect(canAfford(904.004, 904)).toBe(true)
    expect(canAfford(904.006, 904)).toBe(false)
  })
})

describe('unitsOnOffer (spec 12.4, 13.7)', () => {
  const view = makeView()

  it('excludes lots ticked to conserve', () => {
    expect(unitsOnOffer(60, 10, ['L3'], view)).toEqual({ units: 10, lotIds: ['L4'] })
  })

  it('counts every lot at or below the maximum quality, capped by max_units, in cellar order', () => {
    expect(unitsOnOffer(60, 99, [], view)).toEqual({ units: 42, lotIds: ['L3', 'L4'] })
    expect(unitsOnOffer(60, 10, [], view)).toEqual({ units: 10, lotIds: ['L3', 'L4'] })
  })

  it('has no units when no lot is at or below the limit', () => {
    expect(unitsOnOffer(30, 10, [], view)).toEqual({ units: 0, lotIds: [] })
  })

  it('the limit is inclusive', () => {
    expect(unitsOnOffer(33, 99, [], view)).toEqual({ units: 12, lotIds: ['L3'] })
    expect(unitsOnOffer(32, 99, [], view)).toEqual({ units: 0, lotIds: [] })
    expect(unitsOnOffer(57, 99, ['L3'], view)).toEqual({ units: 30, lotIds: ['L4'] })
  })

  it('failure mode 12 (pure part): ticking every matching lot to conserve leaves nothing on offer', () => {
    expect(unitsOnOffer(60, 99, ['L3', 'L4'], view)).toEqual({ units: 0, lotIds: [] })
  })
})

describe('isWholeCents (spec 4.3)', () => {
  it('accepts whole-cent values', () => {
    for (const x of [0, 15, 15.1, 0.01, 19.99, 10000]) expect(isWholeCents(x)).toBe(true)
  })

  it('failure mode 15 (pure part): rejects a fraction of a cent', () => {
    for (const x of [15.005, 0.015, 1.005, 0.001]) expect(isWholeCents(x)).toBe(false)
  })
})
