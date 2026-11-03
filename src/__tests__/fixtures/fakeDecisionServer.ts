/**
 * A test double for the server's `preview_decision` answer (`PulkyEngine.decision_preview`, spec §12.4), so the
 * form tests can drive the form through real-looking answers. The app computes none of this: the backend's own
 * tests (`tests/test_core/test_decision_preview.py`) check the real figures. Each rule names its spec section.
 */
import { vi } from 'vitest'
import type {
  DecisionDraft,
  DecisionPreview,
  DecisionPreviewAnswer,
  DraftTierPlan,
  FieldIssue,
  PlayerView,
  PublicConfig,
} from '../../types/game'
import { useGameStore } from '../../store/gameStore'

export const ROOM = 'ABC234'

const cents = (x: number): number => Math.round(x * 100) / 100
const money = (x: number): string => `$${x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const whole = (x: unknown, lo: number, hi: number): boolean => typeof x === 'number' && Number.isInteger(x) && x >= lo && x <= hi
const price = (x: unknown): boolean =>
  typeof x === 'number' && Number.isFinite(x) && Math.abs(x * 100 - Math.round(x * 100)) < 1e-6 && x >= 0.01 && x <= 10000

/** Spec §4.3's messages, with the server's MAX_ORDER. */
export function messages(maxOrder = 9999) {
  const n = maxOrder.toLocaleString('en-US')
  return {
    order: `Orders must be whole numbers from 0 to ${n}.`,
    price: 'Peer prices must be from $0.01 to $10,000.00, in whole cents.',
    quality: 'Quality limits must be whole numbers from 0 to 100.',
    units: `You can offer from 1 to ${n} units.`,
  }
}

/** The double's answer for one draft. */
export function fakeDecisionPreview(view: PlayerView, config: PublicConfig, draft: DecisionDraft): DecisionPreview {
  const maxOrder = useGameStore.getState().limits?.MAX_ORDER ?? 9999
  const msg = messages(maxOrder)
  const errors: FieldIssue[] = []
  if (!whole(draft.order_spot, 0, maxOrder)) errors.push({ field: 'order_spot', message: msg.order })
  if (!whole(draft.order_futures, 0, maxOrder)) errors.push({ field: 'order_futures', message: msg.order })
  if (draft.peer_buy) {
    if (!price(draft.peer_buy.max_price)) errors.push({ field: 'peer_buy.max_price', message: msg.price })
    if (!whole(draft.peer_buy.min_quality, 0, 100)) errors.push({ field: 'peer_buy.min_quality', message: msg.quality })
  }
  if (draft.peer_sell) {
    if (!price(draft.peer_sell.price)) errors.push({ field: 'peer_sell.price', message: msg.price })
    if (!whole(draft.peer_sell.max_quality, 0, 100)) errors.push({ field: 'peer_sell.max_quality', message: msg.quality })
    if (!whole(draft.peer_sell.max_units, 1, maxOrder)) errors.push({ field: 'peer_sell.max_units', message: msg.units })
  }
  const bad = new Set(errors.map((e) => e.field))
  const brief = view.brief
  const spotPrice = brief?.supplier.spot_price ?? 0
  const base = brief?.supplier.base_price ?? 0
  const due = view.futures_book.filter((c) => c.ships_day === view.day).reduce((s, c) => s + c.qty, 0)

  let outlay: DecisionPreview['outlay'] = null
  let affordable: boolean | null = null
  let unaffordable: string | null = null
  let shipment: number | null = null
  let plans: DraftTierPlan[] | null = null
  if (!bad.has('order_spot') && !bad.has('order_futures')) {
    const spot = draft.order_spot ?? 0
    const futures = draft.order_futures ?? 0
    const fee = draft.incoterm_tier === 'exw' ? 0 : (view.tier_plans.find((p) => p.tier === draft.incoterm_tier)?.fee_per_unit ?? 0)
    const conservation = view.cellar
      .filter((lot) => draft.conserve_lots.includes(lot.id))
      .reduce((s, lot) => s + (lot.conservation_cost ?? 0), 0)
    // spec §8.3: transport and the fee on the spot order, the fee alone on the futures due today
    const parts = {
      spot: spotPrice * spot,
      futures: base * futures,
      shipping: (config.transport.unit_cost + fee) * spot + fee * due,
      conservation,
    }
    const total = parts.spot + parts.futures + parts.shipping + parts.conservation
    outlay = {
      spot: cents(parts.spot),
      futures: cents(parts.futures),
      shipping: cents(parts.shipping),
      conservation: cents(parts.conservation),
      total: cents(total),
    }
    affordable = total <= 0 || cents(total) <= view.cash
    unaffordable = affordable ? null : `Today's purchases cost ${money(cents(total))} but you only have ${money(view.cash)}`
    shipment = spot + due
    plans = view.tier_plans.map((p) => {
      const row: DraftTierPlan = { ...p, fee_for_shipment: cents(p.fee_per_unit * (spot + due)) }
      // spec §6.3: Paid-price insurance refunds the shipment's average price paid
      if (p.tier === 'cip' && due > 0) {
        row.refund_value_today = (spotPrice * spot + base * due) / (spot + due)
        row.refund_shipment = { spot_units: spot, futures_units: due }
      }
      return row
    })
  }

  let offer: DecisionPreview['offer'] = null
  if (config.peer_market.enabled && draft.peer_sell && !bad.has('peer_sell.max_quality')) {
    const maxQuality = draft.peer_sell.max_quality as number
    const lots = view.cellar.filter((lot) => !draft.conserve_lots.includes(lot.id) && lot.quality <= maxQuality)
    const units = lots.reduce((s, lot) => s + lot.qty, 0)
    const cap = bad.has('peer_sell.max_units') ? null : draft.peer_sell.max_units
    offer = { units: cap === null ? units : Math.min(units, cap), lot_ids: lots.map((lot) => lot.id) }
  }

  return {
    day: draft.day,
    outlay,
    affordable,
    unaffordable_message: unaffordable,
    shipment_units: shipment,
    tier_plans: plans,
    offer,
    errors,
  }
}

type PreviewFn = (room: string, draft: DecisionDraft) => Promise<DecisionPreviewAnswer>

/** Points the mocked `previewDecision` at the double for this view and config. */
export function serveDecisionPreviews(mock: ReturnType<typeof vi.fn<PreviewFn>>, view: PlayerView, config: PublicConfig): void {
  useGameStore.setState({ roomCode: ROOM })
  mock.mockImplementation((_room, draft) => Promise.resolve({ preview: fakeDecisionPreview(view, config, draft) }))
}
