// Fixtures for the section 31 tests: the worked-example props `F` (plan 31 §4) and the sweep of §6.
// Only wire types and BoardViewProps are imported, and only as types.
import type { BoardViewProps } from '../../components/game/views/Board2D'
import type {
  CellarLot,
  Decision,
  FuturesContract,
  InTransit,
  IncotermTier,
  PlayerView,
  PublicConfig,
  PublicDayResults,
  Weekday,
} from '../../types/game'

export interface LooseBrief {
  weekday_multiplier: number
  supplier: {
    disrupted: boolean
    disruption_message: string | null
    spot_price: number
    base_price: number
    lead_time_days: number
  }
  spot: { open: boolean; arrives_day: number }
  transport: { shared: boolean }
}

export interface Variant {
  name: string
  props: BoardViewProps
}

export const DISRUPTION_MESSAGE = 'Day 5 (Friday): supplier capacity cut to 40%'
export const RIVAL_NAME = 'Zacatecas Rival'

/** A cellar lot. `risk_tonight` is deliberately the unrounded server hazard, which can differ from `(100 - quality) / 100`:
 *  the scene must show `100 - quality` (spec §3.5), never a figure rounded from `risk_tonight`. */
export function cellarLot(id: string, qty: number, quality: number, conserved = false): CellarLot {
  return {
    id,
    qty,
    age: 1,
    unit_cost: 10,
    initial_quality: 90,
    conserved,
    quality,
    last_day: 9,
    risk_tonight: Math.min(1, (100 - quality + 0.57) / 100),
    expected_loss_tonight: 0,
  } as unknown as CellarLot
}

export function shipment(
  shipped_day: number,
  arrives_day: number,
  qty: number,
  lost: number,
  incoterm_tier: IncotermTier,
): InTransit {
  return { shipped_day, arrives_day, qty, lost, incoterm_tier } as unknown as InTransit
}

export function contract(contract_day: number, delivery_day: number, qty: number): FuturesContract {
  return { contract_day, ships_day: delivery_day - 1, delivery_day, qty } as unknown as FuturesContract
}

export function dayResults(opts: {
  day: number
  unitsSoldTotal: number
  peerUnits: number
  peerAvgPrice: number | null
  own: { units_sold: number; market_share: number } | null
}): PublicDayResults {
  const players: Record<string, unknown> = {
    P2: { display_name: RIVAL_NAME, units_sold: 31, market_share: 0.34, reputation: 0.55 },
  }
  if (opts.own) players.P1 = { display_name: 'Ana', reputation: 0.62, ...opts.own }
  return {
    day: opts.day,
    weekday: 'thu',
    demand_total: 100,
    units_sold_total: opts.unitsSoldTotal,
    spot_price: 13,
    disrupted: false,
    cooperation: false,
    cooperators: [],
    refrigeration_failure: false,
    peer_units: opts.peerUnits,
    peer_avg_price: opts.peerAvgPrice,
    players,
  } as unknown as PublicDayResults
}

export function briefOf(p: BoardViewProps): LooseBrief {
  return p.view.brief as unknown as LooseBrief
}

/** The worked-example props `F`: day 5 (fri) of 14, alias P1, peer market on. Always a fresh object. */
export function baseProps(): BoardViewProps {
  const view = {
    alias: 'P1',
    display_name: 'Ana',
    day: 5,
    duration_days: 14,
    weekday: 'fri' as Weekday,
    phase: 'deciding',
    has_submitted: false,
    awaiting: [],
    brief: {
      day: 5,
      duration_days: 14,
      weekday: 'fri',
      weekday_multiplier: 1,
      expected_demand: 100,
      supplier: {
        disrupted: false,
        disruption_message: null,
        spot_price: 13.4,
        base_price: 12,
        lead_time_days: 1,
      },
      spot: { open: true, arrives_day: 6 },
      transport: { shared: false },
    },
    yesterday: { spoiled: 6, revenue_salvage: 12, demand: 27, sold: 24 },
    cellar: [cellarLot('L3', 12, 0), cellarLot('L4', 30, 23), cellarLot('L5', 45, 90, true)],
    stock_by_age: [],
    quality_guide: [],
    expected_spoil_tonight: 0,
    in_transit: [shipment(4, 5, 40, 15, 'cip')],
    futures_book: [contract(5, 12, 25)],
    backlog: 3,
    expected_demand_own: 27.4,
    reputation: 0.62,
    market_share: 0.26,
    cash: 6120,
    cumulative_profit: 0,
    tier_plans: [],
    final_settlement: null,
    full: true,
  }
  const initialDecision = {
    day: 5,
    order_spot: 0,
    order_futures: 0,
    incoterm_tier: 'exw',
    conserve_lots: [],
    cooperate: false,
    peer_buy: null,
    peer_sell: null,
  } as unknown as Decision
  const config = {
    demand: { retail_price: 20 },
    stock: { conservation_extra_fresh_days: 2, conservation_cost_per_unit: 1 },
    peer_market: { enabled: true },
    transport: { unit_cost: 1 },
  } as unknown as PublicConfig
  return {
    view: view as unknown as PlayerView,
    ownHistory: [],
    publicHistory: [
      dayResults({
        day: 4,
        unitsSoldTotal: 92,
        peerUnits: 18,
        peerAvgPrice: 14.11,
        own: { units_sold: 24, market_share: 0.26 },
      }),
    ],
    lastRecord: null,
    locked: false,
    gameOver: false,
    initialDecision,
    config,
    participants: [
      { alias: 'P1', display_name: 'Ana', connected: true },
      { alias: 'P2', display_name: RIVAL_NAME, connected: true },
    ],
    awaiting: [],
    onSubmit: () => undefined,
  }
}

/** F, then `fn` edits it. */
export function variant(fn: (p: BoardViewProps) => void): BoardViewProps {
  const p = baseProps()
  fn(p)
  return p
}

export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key])
  }
  return value
}

const QUALITIES = [0, 23, 57, 90, 100]
const QUANTITIES = [1, 59, 60, 99999, 12, 45, 30]
const TIERS: IncotermTier[] = ['exw', 'cip', 'dap', 'ddp']
const SHIP_QTY = [40, 99999, 1, 59]
const ARRIVALS = [60, 5, 33, 12, 1]

/** `n` lots mixing qualities, conserved lots, a bought lot `B60-11` and quantities 1, 59, 60 and 99,999. */
export function mixedCellar(n: number): CellarLot[] {
  return Array.from({ length: n }, (_, i) =>
    cellarLot(
      i === 1 ? 'B60-11' : `L${i + 1}`,
      QUANTITIES[i % QUANTITIES.length],
      QUALITIES[i % QUALITIES.length],
      i % 2 === 1,
    ),
  )
}

/** `n` shipments (listed in reverse arrival order), every tier, quantities up to 99,999, arrival days up to 60. */
export function mixedShipments(n: number, allLost: boolean): InTransit[] {
  const list = Array.from({ length: n }, (_, i) => {
    const qty = SHIP_QTY[i % SHIP_QTY.length]
    const lost = allLost ? qty : i % 2 === 0 ? Math.floor(qty / 2) : 0
    return shipment(40 + i, ARRIVALS[i % ARRIVALS.length], qty, lost, TIERS[i % TIERS.length])
  })
  return list.reverse()
}

/** `n` shipments that each lose all 99,999 units: the widest lost signs possible, side by side. */
export function bigShipments(n: number): InTransit[] {
  return Array.from({ length: n }, (_, i) => shipment(40 + i, 10 + i, 99999, 99999, TIERS[i % TIERS.length])).reverse()
}

export function manyContracts(n: number): FuturesContract[] {
  return Array.from({ length: n }, (_, i) => contract(1 + (i % 3), 6 + ((i * 7) % 11), 10 + i)).reverse()
}

/** Every extreme figure at once. */
function applyExtremes(p: BoardViewProps): void {
  Object.assign(p.view, {
    day: 60,
    duration_days: 60,
    weekday: 'wed',
    cash: 9999999.99,
    backlog: 99999,
    expected_demand_own: 99999,
    reputation: 1,
    yesterday: { spoiled: 99999, revenue_salvage: 9999999.99 },
  })
  const brief = briefOf(p)
  brief.supplier.spot_price = 999.99
  brief.supplier.base_price = 999.99
  brief.supplier.disrupted = true
  brief.supplier.disruption_message = DISRUPTION_MESSAGE
  brief.transport.shared = true
  brief.spot.arrives_day = 60
  p.publicHistory = [
    dayResults({
      day: 59,
      unitsSoldTotal: 99999,
      peerUnits: 99999,
      peerAvgPrice: 9999.99,
      own: { units_sold: 99999, market_share: 1 },
    }),
  ]
}

/** The §6 sweep. Every entry is a complete `BoardViewProps`. */
export function sweepVariants(): Variant[] {
  const out: Variant[] = []
  const add = (name: string, fn: (p: BoardViewProps) => void): void => {
    out.push({ name, props: variant(fn) })
  }
  add('F', () => undefined)
  for (const n of [0, 1, 2, 5, 6, 7, 12]) add(`cellar ${n}`, (p) => void (p.view.cellar = mixedCellar(n)))
  for (let n = 0; n <= 7; n += 1) {
    add(`shipments ${n}`, (p) => void (p.view.in_transit = mixedShipments(n, false)))
    add(`shipments ${n} all lost`, (p) => void (p.view.in_transit = mixedShipments(n, true)))
  }
  for (let n = 1; n <= 7; n += 1) add(`shipments ${n} big`, (p) => void (p.view.in_transit = bigShipments(n)))
  for (const n of [0, 1, 5, 6, 14]) add(`contracts ${n}`, (p) => void (p.view.futures_book = manyContracts(n)))
  for (const cash of [-999999.99, 0, 999.99, 16000, 9999999.99]) add(`cash ${cash}`, (p) => void (p.view.cash = cash))
  for (const backlog of [0, 99999]) add(`backlog ${backlog}`, (p) => void (p.view.backlog = backlog))
  add('day 1', (p) => {
    Object.assign(p.view, { day: 1, weekday: 'mon', yesterday: null })
    p.publicHistory = []
    p.ownHistory = []
  })
  add('day 60 of 60', (p) => Object.assign(p.view, { day: 60, duration_days: 60, weekday: 'wed' }))
  for (const enabled of [true, false]) {
    for (const trades of [true, false]) {
      add(`peer ${enabled ? 'on' : 'off'} ${trades ? 'trades' : 'no trades'}`, (p) => {
        p.config.peer_market.enabled = enabled
        p.publicHistory = [
          dayResults({
            day: 4,
            unitsSoldTotal: 92,
            peerUnits: trades ? 99999 : 0,
            peerAvgPrice: trades ? 9999.99 : null,
            own: { units_sold: 24, market_share: 0.26 },
          }),
        ]
      })
    }
  }
  for (const disrupted of [true, false]) {
    for (const shared of [true, false]) {
      for (const open of [true, false]) {
        add(`disrupted ${disrupted} shared ${shared} spot open ${open}`, (p) => {
          const brief = briefOf(p)
          brief.supplier.disrupted = disrupted
          brief.supplier.disruption_message = disrupted ? DISRUPTION_MESSAGE : null
          brief.transport.shared = shared
          brief.spot.open = open
        })
      }
    }
  }
  add('brief null', (p) => Object.assign(p.view, { brief: null }))
  add('locked', (p) => {
    p.locked = true
  })
  for (const cellar of [0, 1, 5, 6, 7, 12]) {
    for (let ships = 0; ships <= 7; ships += 1) {
      add(`extremes cellar ${cellar} shipments ${ships}`, (p) => {
        applyExtremes(p)
        p.view.cellar = mixedCellar(cellar)
        p.view.in_transit = mixedShipments(ships, true)
        p.view.futures_book = manyContracts(14)
      })
    }
  }
  add('extremes negative cash', (p) => {
    applyExtremes(p)
    p.view.cash = -999999.99
    p.view.cellar = mixedCellar(6)
    p.view.in_transit = mixedShipments(4, true)
  })
  return out
}

/** The §6 maximal variant for the budget: 6 lots, 4 shipments all with losses, disrupted, peer trades. */
export function maximalProps(): BoardViewProps {
  return variant((p) => {
    p.view.cellar = mixedCellar(6)
    p.view.in_transit = mixedShipments(4, true)
    const brief = briefOf(p)
    brief.supplier.disrupted = true
    brief.supplier.disruption_message = DISRUPTION_MESSAGE
    brief.transport.shared = true
    p.view.futures_book = manyContracts(5)
  })
}
