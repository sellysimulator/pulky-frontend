import type { IncotermTier, PeerBuy, PeerSell, PlayerView, PublicConfig } from '../types/game'
import { roundCents } from '../utils/money'

export interface DecisionDraft {
  order_spot: number
  order_futures: number
  incoterm_tier: IncotermTier
  conserve_lots: string[]
  cooperate: boolean
  peer_buy: PeerBuy | null
  peer_sell: PeerSell | null
}

export interface OutlayEstimate {
  spot: number
  futures: number
  shipping: number
  conservation: number
  total: number
  shipmentMax: number
}

export interface OfferEstimate {
  units: number
  lotIds: string[]
}

/** Units of futures contracts that ship today (spec §8.3). */
export function futuresDueToday(view: PlayerView): number {
  return view.futures_book.filter((c) => c.ships_day === view.day).reduce((sum, c) => sum + c.qty, 0)
}

/** The tier's fee per unit shipped, from the view's plans; EXW is free. */
export function tierFee(incoterm_tier: IncotermTier, view: PlayerView): number {
  if (incoterm_tier === 'exw') return 0
  return view.tier_plans.find((p) => p.tier === incoterm_tier)?.fee_per_unit ?? 0
}

/** Unrounded conservation cost of the ticked cellar lots. */
export function conservationCost(lotIds: string[], view: PlayerView, config: PublicConfig): number {
  const units = view.cellar.filter((lot) => lotIds.includes(lot.id)).reduce((sum, lot) => sum + lot.qty, 0)
  return config.stock.conservation_cost_per_unit * units
}

/** Spec §8.3. Peer purchases are not part of the outlay. */
export function outlayEstimate(draft: DecisionDraft, view: PlayerView, config: PublicConfig): OutlayEstimate {
  const spotPrice = view.brief?.supplier.spot_price ?? 0
  const basePrice = view.brief?.supplier.base_price ?? 0
  const fee = tierFee(draft.incoterm_tier, view)
  const due = futuresDueToday(view)
  const spot = spotPrice * draft.order_spot
  const futures = basePrice * draft.order_futures
  const shipping = (config.transport.unit_cost + fee) * draft.order_spot + fee * due
  const conservation = conservationCost(draft.conserve_lots, view, config)
  return {
    spot: roundCents(spot),
    futures: roundCents(futures),
    shipping: roundCents(shipping),
    conservation: roundCents(conservation),
    total: roundCents(spot + futures + shipping + conservation),
    shipmentMax: draft.order_spot + due,
  }
}

/** Spec §8.3: a zero outlay is always affordable. */
export function canAfford(total: number, cash: number): boolean {
  return total === 0 || roundCents(total) <= cash
}

/** Spec §12.4 "units on offer", leaving out the lots ticked to conserve. */
export function unitsOnOffer(maxQuality: number, maxUnits: number, conserveLots: string[], view: PlayerView): OfferEstimate {
  const lots = view.cellar.filter((lot) => !conserveLots.includes(lot.id) && lot.quality <= maxQuality)
  const total = lots.reduce((sum, lot) => sum + lot.qty, 0)
  return { units: Math.min(total, maxUnits), lotIds: lots.map((lot) => lot.id) }
}

/** Spec §4.3: a price in whole cents. */
export function isWholeCents(x: number): boolean {
  return Math.abs(x * 100 - Math.round(x * 100)) < 1e-6
}
