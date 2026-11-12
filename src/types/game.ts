/**
 * Wire types for Pulky. Hand-written, one place, snake_case exactly as on the
 * wire (spec §2, §12; backend contracts of sections 03, 04, 10, 11, 13-16, 19).
 */

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
/** Monday first: the order of the weekday index (spec §7.1) and of every weekday row. */
export const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/** A shipping insurance by its id: the per-shipment contract that decides whether, and at
 * what value, lost units are refunded (spec §6.3). */
export type IncotermTier = 'exw' | 'cip' | 'dap' | 'ddp'
/** The tiers that refund lost units: the host can disable them and set their fees. */
export type InsuredTier = Exclude<IncotermTier, 'exw'>
/** Every tier, from no protection to the most (spec §6.3's order). */
export const INCOTERM_TIERS: readonly IncotermTier[] = ['exw', 'cip', 'dap', 'ddp']
export const INSURED_TIERS: readonly InsuredTier[] = ['cip', 'dap', 'ddp']
export type RoomState = 'lobby' | 'configuring' | 'running' | 'finished'
export type Phase = 'deciding' | 'finished'
export type TradeSide = 'buy' | 'sell'

/**
 * The backend's hard limits (spec §9.2), as `GET /config/defaults` serves them in
 * `limits`. The client holds no copy: `useLimits()` (src/api/config.ts) reads them
 * into the store (spec §13.6).
 */
export interface Limits {
  MAX_ORDER: number
  MAX_PEER_PRICE: number
  MAX_DISPLAY_NAME: number
  [name: string]: number
}

/** Spec §9.3's five shown dot paths, in section 04's order. */
export const PLAYER_CONFIG_KEYS: readonly string[] = [
  'demand.retail_price',
  'stock.conservation_extra_fresh_days',
  'stock.conservation_cost_per_unit',
  'peer_market.enabled',
  'transport.unit_cost',
]

/** Spec §9.3's seven secret dot paths, in that order. */
export const SECRET_CONFIG_KEYS: readonly string[] = [
  'random_seed',
  'supplier.capacity_sd_per_player',
  'supplier.disruption_probability',
  'transport.failure_probability',
  'transport.loss_fraction',
  'insurance.target_margin',
  'insurance.reference_shipment',
]

// ---------------------------------------------------------------- config

export interface InsuredTierConfig {
  enabled: boolean
  fee: number
}

export interface GameConfig {
  max_players: number
  duration_days: number
  starting_cash: number
  random_seed: number | null
  demand: {
    per_player_peak: number
    weekday_peak: { from: Weekday; to: Weekday }
    retail_price: number
    backlog_penalty: number
  }
  reputation: {
    starting: number
    smoothing: number
    waste_weight: number
  }
  supplier: {
    base_price: number
    spot_spread: number
    capacity_mean_per_player: number
    /** Null in a host's config: the hidden default (spec §9.3). */
    capacity_sd_per_player: number | null
    /** Null in a host's config: the hidden default (spec §9.3). */
    disruption_probability: number | null
    disruption_factor: number
    lead_time_days: number
    initial_pipeline_qty: number
    quality_min: number
    quality_max: number
  }
  futures: {
    horizon_days: number
  }
  stock: {
    fresh_days: number
    max_days: number
    holding_cost: number
    initial_stock: number
    salvage_value: number
    conservation_extra_fresh_days: number
    conservation_cost_per_unit: number
  }
  peer_market: {
    enabled: boolean
  }
  transport: {
    unit_cost: number
    shared: boolean
    /** Null in a host's config: the hidden default (spec §9.3). */
    failure_probability: number | null
    /** Null in a host's config: the hidden default (spec §9.3). */
    loss_fraction: number | null
  }
  insurance: {
    tiers: {
      cip: InsuredTierConfig
      dap: InsuredTierConfig
      ddp: InsuredTierConfig
    }
    target_margin: number
    reference_shipment: number
  }
}

/** Spec §9.3's five shown keys, at their full-config paths. */
export interface PublicConfig {
  demand: { retail_price: number }
  stock: {
    conservation_extra_fresh_days: number
    conservation_cost_per_unit: number
  }
  peer_market: { enabled: boolean }
  transport: { unit_cost: number }
}

export interface ConfigFieldMeta {
  type: 'int' | 'float' | 'bool' | 'weekday'
  min: number | null
  max: number | null
  nullable: boolean
  players: 'shown' | 'not_shown' | 'secret'
  /** A risk whose default no host sees before the game ends; null in the config stands for it (spec §9.3). */
  hidden_default: boolean
}

export interface ConfigDefaultsResponse {
  config: GameConfig
  fields: Record<string, ConfigFieldMeta>
  limits: Limits
}

export interface FieldIssue {
  field: string | null
  message: string
}

export interface ValidateConfigResponse {
  ok: boolean
  errors: FieldIssue[]
  warnings: FieldIssue[]
}

// ---------------------------------------------------------------- the day

/** Spec §4.2. */
export interface Brief {
  day: number
  duration_days: number
  weekday: Weekday
  weekday_multiplier: number
  weekday_multipliers: Record<Weekday, number>
  expected_demand: number
  supplier: {
    disrupted: boolean
    disruption_message: string | null
    spot_price: number
    base_price: number
    lead_time_days: number
  }
  spot: { open: boolean; arrives_day: number; arrives_weekday: Weekday }
  futures: {
    open: boolean
    price: number
    horizon_days: number
    delivery_day: number
    delivery_weekday: Weekday
    last_day_to_buy: number
    days_left_to_buy: number
  }
  transport: { shared: boolean }
  reputation: Record<string, number>
}

export interface PeerBuy {
  max_price: number
  min_quality: number
}

export interface PeerSell {
  price: number
  max_quality: number
  max_units: number
}

/** Spec §4.3. Both peer keys are always present. */
export interface Decision {
  day: number
  order_spot: number
  order_futures: number
  incoterm_tier: IncotermTier
  conserve_lots: string[]
  cooperate: boolean
  peer_buy: PeerBuy | null
  peer_sell: PeerSell | null
}

export interface PeerTrade {
  side: TradeSide
  counterparty: string
  lot_id: string
  qty: number
  quality: number
  price: number
}

/** Every key of the backend DayRecord (section 03). */
export interface DayRecord {
  day: number
  weekday: Weekday
  order_spot: number
  order_futures: number
  incoterm_tier: IncotermTier
  conserve_lots: string[]
  lots_conserved: number
  cooperate: boolean
  peer_buy: PeerBuy | null
  peer_sell: PeerSell | null
  outlay: number
  opening_stock: number
  futures_due: number
  futures_filled: number
  futures_unfilled: number
  allocated_spot: number
  shortfall_spot: number
  shipped: number
  lost_transport: number
  delivered: number
  peer_bought: number
  peer_sold: number
  peer_trades: PeerTrade[]
  demand: number
  backlog_open: number
  sold: number
  backlog_end: number
  spoiled: number
  closing_stock: number
  revenue_sales: number
  revenue_salvage: number
  revenue_peer: number
  refund_insurance: number
  refund_futures: number
  cost_spot: number
  cost_futures: number
  cost_peer: number
  cost_transport: number
  cost_insurance: number
  cost_conservation: number
  cost_holding: number
  cost_backlog: number
  profit: number
  cash_open: number
  cash_end: number
  futures_vs_spot: number
  fill: number
  waste: number
  reputation_open: number
  reputation_end: number
  market_share: number
  refrigeration_failure: boolean
}

/** Spec §12.2 `day_closed.public`, with `day`. */
export interface PublicDayResults {
  day: number
  weekday: Weekday
  demand_total: number
  units_sold_total: number
  spot_price: number
  disrupted: boolean
  cooperation: boolean
  cooperators: number
  refrigeration_failure: boolean
  peer_units: number
  peer_avg_price: number | null
  players: Record<
    string,
    {
      display_name: string
      units_sold: number
      market_share: number
      reputation: number
    }
  >
}

/** Section 03 MarketDay. */
export interface MarketDay {
  day: number
  weekday: Weekday
  weekday_multiplier: number
  expected_demand: number
  demand_total: number
  capacity: number
  disrupted: boolean
  spot_price: number
  cooperation: boolean
  cooperators: number
  refrigeration_failure: boolean
  units_sold_total: number
  peer_units: number
  peer_avg_price: number | null
}

/** Spec §8.2. */
export interface FinalSettlement {
  liquidated_units: number
  revenue_liquidation: number
  refund_insurance_in_transit: number
  futures_cancelled_units: number
  refund_futures_cancelled: number
  settlement_total: number
}

/** Spec §8.4. */
export interface Yesterday {
  day: number
  demand: number
  sold: number
  backlog_end: number
  backlog_change: number
  spoiled: number
  revenue_salvage: number
  reputation: number
  reputation_change: number
  profit: number
  cash_end: number
  futures_bought: number
  futures_filled: number
  futures_vs_spot: number
  futures_unfilled: number
  refund_futures: number
  refrigeration_failure: boolean
  lost_transport: number
  refund_insurance: number
  market_share: number
  shortfall_spot: number
  peer_bought: number
  cost_peer: number
  peer_sold: number
  revenue_peer: number
}

/** Spec §12.4 tier plan row, one per shipping insurance (no refund range). */
export interface IncotermTierPlan {
  tier: IncotermTier
  label: string
  enabled: boolean
  refund_basis: string
  /** What the engine would refund per lost unit of today's shipment, computed by the server (spec §6.3). */
  refund_value_today: number | null
  /** The shipment `refund_value_today` assumed, when it depends on the spot order (Paid-price with futures due). */
  refund_shipment: { spot_units: number; futures_units: number } | null
  fee_per_unit: number
}

export interface OrderWindows {
  spot_open: boolean
  futures_open: boolean
  futures_days_left_to_buy: number
  futures_message: string
  spot_message: string
}

/** Spec §12.4 cellar entry: no fresh_days or max_days. */
export interface CellarLot {
  id: string
  qty: number
  age: number
  unit_cost: number
  initial_quality: number
  conserved: boolean
  quality: number
  /** Days the lot can still be sold, counting today (spec §3.5). */
  days_left: number
  last_day: number
  risk_tonight: number
  expected_loss_tonight: number
  /** What conserving the lot costs today, null once it is conserved (spec §3.4). */
  conservation_cost: number | null
}

export interface StockByAge {
  age: number
  plain_qty: number
  conserved_qty: number
  plain_risk_tonight: number
  conserved_risk_tonight: number
}

export interface InTransit {
  shipped_day: number
  arrives_day: number
  qty: number
  lost: number
  incoterm_tier: IncotermTier
}

export interface FuturesContract {
  contract_day: number
  ships_day: number
  delivery_day: number
  qty: number
}

/** Spec §3.5, §12.4. */
export interface QualityGuideRow {
  quality: number
  half_spoiled_day: number
  /** Days a unit of this quality can still be sold, counting the guide's day (spec §3.5). */
  days_left: number
  last_day: number
}

/** Spec §12.4 plus `full`. History keys only in the full form (spec §12.6). */
export interface PlayerView {
  full: boolean
  alias: string
  display_name: string
  day: number
  duration_days: number
  weekday: Weekday
  phase: Phase
  has_submitted: boolean
  awaiting: string[]
  brief: Brief | null
  yesterday: Yesterday | null
  cellar: CellarLot[]
  stock_by_age: StockByAge[]
  quality_guide: QualityGuideRow[]
  expected_spoil_tonight: number
  in_transit: InTransit[]
  futures_book: FuturesContract[]
  backlog: number
  expected_demand_own: number
  reputation: number
  market_share: number
  cash: number
  cumulative_profit: number
  tier_plans: IncotermTierPlan[]
  /** Null once the game is over, with `prefill_decision`: there is no day left to decide. */
  order_windows: OrderWindows | null
  prefill_decision: Decision | null
  own_history?: DayRecord[]
  public_history?: PublicDayResults[]
  final_settlement: FinalSettlement | null
}

/** A view with a day open for decisions: what the decision form reads. */
export type DecidingView = PlayerView & { order_windows: OrderWindows }

export interface LeaderboardRow {
  rank: number
  alias: string
  display_name: string
  total_profit: number
  fill_rate: number | null
  waste_rate: number | null
}

/** Spec §12.5 player row, plus `connected` from the socket layer. */
export interface HostPlayerRow {
  display_name: string
  connected: boolean
  has_submitted: boolean
  stock_units: number
  expected_spoil_tonight: number
  in_transit_units: number
  open_futures_units: number
  backlog: number
  reputation: number
  market_share: number
  cumulative_profit: number
  cash: number
  fill_rate: number | null
  waste_rate: number | null
  last_incoterm_tier: IncotermTier | null
  last_peer_bought: number | null
  last_peer_sold: number | null
  own_history?: DayRecord[]
  /** The profit race's points, full form only (spec §12.5): profit so far after each day. */
  cumulative_profit_by_day?: number[]
  last_record?: DayRecord | null
}

/** Spec §12.5 plus `full`. */
export interface HostView {
  full: boolean
  state: RoomState
  day: number
  duration_days: number
  weekday: Weekday
  phase: Phase
  brief: Brief | null
  seed: number
  config: GameConfig
  /** The cheapest and dearest spot price the supplier can draw (spec §5.1). */
  spot_range: { low: number; high: number }
  awaiting: string[]
  players: Record<string, HostPlayerRow>
  public_history?: PublicDayResults[]
  market_history?: MarketDay[]
  last_market_day?: MarketDay | null
  leaderboard: LeaderboardRow[]
}

export interface Participant {
  alias: string
  display_name: string
  connected: boolean
}

// ---------------------------------------------------------------- stats (section 10)

/** Spec §8.6: one pulquería's pulque, from the supplier to where it ended. It balances by construction. */
export interface PulqueFlow {
  initial_stock: number
  initial_pipeline: number
  shipped_spot: number
  shipped_futures: number
  lost_transport: number
  in_transit_end: number
  delivered: number
  peer_bought: number
  sold: number
  peer_sold: number
  spoiled: number
  closing_stock: number
}

export interface PlayerStats {
  alias: string
  display_name: string
  rank: number
  total_profit: number
  revenue_sales: number
  revenue_salvage: number
  revenue_liquidation: number
  refund_insurance: number
  units_sold: number
  overall_market_share: number
  fill_rate: number | null
  days_with_backlog: number
  cost_backlog: number
  waste_rate: number | null
  units_spoiled: number
  liquidated_units: number
  units_lost_transport: number
  cost_insurance: number
  insurance_net: number
  futures_units: number
  futures_unfilled: number
  futures_cancelled_units: number
  futures_vs_spot: number
  futures_share: number | null
  cost_conservation: number
  lots_conserved: number
  shortfall_spot_units: number
  peer_units_bought: number
  peer_units_sold: number
  cost_peer: number
  revenue_peer: number
  peer_net: number
  avg_reputation: number
  final_reputation: number
  days_cooperated: number
  peak_stock: number
  peak_backlog: number
  incoterm_tier_days: Record<IncotermTier, number>
  series: {
    delivered: number[]
    peer_bought: number[]
    peer_sold: number[]
    sold: number[]
    spoiled: number[]
    backlog_end: number[]
    closing_stock: number[]
    reputation: number[]
    profit: number[]
    /** Profit so far after each day, in cents: the profit race's points (spec §8.6). */
    cumulative_profit: number[]
    cooperate: boolean[]
  }
  final_settlement: FinalSettlement
  flow?: PulqueFlow
}

export interface MarketStats {
  demand_total: number
  units_sold_total: number
  cooperation_days: number
  failure_days: number
  disruption_days: number
  avg_spot_price: number | null
  min_spot_price: number | null
  max_spot_price: number | null
  peer_units_total: number
  peer_trade_days: number
  avg_peer_price: number | null
  series: {
    weekday: Weekday[]
    weekday_multiplier: number[]
    demand: number[]
    delivered: number[]
    sold: number[]
    spoiled: number[]
    backlog_end: number[]
    spot_price: number[]
    capacity: number[]
    cooperators: number[]
    cooperation_reached: boolean[]
    refrigeration_failure: boolean[]
    disrupted: boolean[]
    peer_units: number[]
    peer_avg_price: Array<number | null>
  }
}

export interface GameStats {
  players: Record<string, PlayerStats>
  market: MarketStats
}

// ---------------------------------------------------------------- REST

/** Section 19. */
export interface ResultsResponse {
  game_id: string
  room_code: string
  host_display_name: string
  duration_days: number
  days_played: number
  ended_early: boolean
  started_at: string
  finished_at: string
  leaderboard: LeaderboardRow[]
  stats: GameStats
  /** The full config the game ran with, the hidden defaults revealed (spec §9.3). */
  config?: GameConfig
}

export interface MyGameResponse extends ResultsResponse {
  my_alias: string
}

export interface MyGameRow {
  game_id: string
  room_code: string
  finished_at: string
  days_played: number
  duration_days: number
  player_count: number
  ended_early: boolean
  alias: string
  display_name: string
  rank: number
  total_profit: number
}

export interface UserMe {
  display_name: string | null
  email: string | null
  photo_url: string | null
}

export interface UserStats {
  games_played: number
  wins: number
  total_profit: number
  best_profit: number
  avg_fill_rate: number | null
  avg_waste_rate: number | null
  avg_market_share: number | null
}

/** Spec §13.4; a missing room has null state and host name. */
export interface RoomStatus {
  ok: boolean
  reason?: string
  state: RoomState | null
  host_display_name: string | null
  seats_taken: number
  seats_total: number
}

export interface CreateRoomResponse {
  room_code: string
  host_secret: string
  state: RoomState
  config: GameConfig
}

// ---------------------------------------------------------------- server events (spec §12.2)

export interface JoinedPayload {
  alias: string
  session_token: string
  display_name: string
}

export interface HostClaimedPayload {
  room_id: string
  host_secret: string
}

export interface JoinErrorPayload {
  message: string
}

export interface LeaveAckPayload {
  room_id: string
}

export interface LobbyUpdatePayload {
  seq: number
  state: RoomState
  participants: Participant[]
  seats_total: number
  config_locked: boolean
  can_start: boolean
  start_blocked_reason: string | null
}

export interface ConfigUpdatedPayload {
  seq: number
  config: GameConfig | PublicConfig
}

export interface GameStartedPayload {
  seq: number
  duration_days: number
  participants: Participant[]
  config: GameConfig | PublicConfig
}

export interface DayOpenedPayload {
  seq: number
  brief: Brief
}

export interface YourStatePayload extends PlayerView {
  seq: number
}

export interface HostStatePayload extends HostView {
  seq: number
}

export interface DecisionSubmittedPayload {
  seq: number
  day: number
  alias: string
  awaiting: string[]
}

export interface DayClosedPayload {
  seq: number
  day: number
  public: PublicDayResults
}

export interface YourDayClosedPayload {
  seq: number
  day: number
  record: DayRecord
}

export interface ParticipantDisconnectedPayload {
  seq: number
  alias: string
  display_name: string
}

export interface ParticipantReconnectedPayload {
  seq: number
  alias: string
  display_name: string
}

export interface HostDisconnectedPayload {
  seq: number
}

export interface HostReconnectedPayload {
  seq: number
}

export interface GameFinishedPayload {
  seq: number
  /** The finished game's id: its only key from here on, since a room code is reissued. */
  game_id: string
  days_played: number
  ended_early: boolean
  leaderboard: LeaderboardRow[]
  stats: GameStats
  /** The full config the game ran with, the hidden defaults revealed (spec §9.3). */
  config?: GameConfig
}

export interface GamePersistedPayload {
  seq: number
  game_id: string
}

export type ErrorCode =
  | 'NOT_IN_ROOM'
  | 'STALE_DAY'
  | 'ALREADY_SUBMITTED'
  | 'INVALID_DECISION'
  | 'INVALID_CONFIG'
  | 'INVALID_HOST_SECRET'
  | 'GAME_NOT_RUNNING'
  | 'GAME_FINISHED'
  | 'SERVER_ERROR'
  | 'RATE_LIMITED'

export interface ServerError {
  code: ErrorCode | string
  message: string
  field?: string
}

// --------------------------------------------------------- server previews

/** The decision form's draft, as typed: a field may be null or not yet valid (spec §12.4). */
export interface DecisionDraft {
  day: number
  order_spot: number | null
  order_futures: number | null
  incoterm_tier: IncotermTier
  conserve_lots: string[]
  cooperate: boolean
  peer_buy: { max_price: number | null; min_quality: number | null } | null
  peer_sell: { price: number | null; max_quality: number | null; max_units: number | null } | null
}

/** A tier card for the draft's shipment, with the fee on it (spec §6.3, §12.4). */
export interface DraftTierPlan extends IncotermTierPlan {
  fee_for_shipment: number
}

/** `preview_decision`'s figures for a draft (spec §12.1, §12.4); a part is null while a field it needs is in error. */
export interface DecisionPreview {
  day: number
  outlay: { spot: number; futures: number; shipping: number; conservation: number; total: number } | null
  affordable: boolean | null
  unaffordable_message: string | null
  shipment_units: number | null
  tier_plans: DraftTierPlan[] | null
  offer: { units: number; lot_ids: string[] } | null
  errors: FieldIssue[]
}

/**
 * The acknowledgement of `preview_decision`: the preview, or why there is none; null when
 * the event failed or was over an abuse limit (`@guarded`, spec §0.6).
 */
export type DecisionPreviewAnswer = { preview: DecisionPreview } | { code: string; message: string } | null

export type RatioBadge = 'worth_it' | 'break_even' | 'not_worth_it' | 'no_risk'

/** Quality and spoil risk at the check of one night; null once the lot is certainly gone. */
export interface PreviewNight {
  night: number
  quality: number | null
  risk: number | null
}

export interface PreviewLot {
  role: 'lowest' | 'middle' | 'highest' | 'plain' | 'conserved'
  initial_quality: number
  conserved: boolean
  nights: PreviewNight[]
}

export interface CalculatorCase {
  break_even: number
  ratio: number | null
  badge: RatioBadge
  worst_single_failure: number
  fee_from_margin: number
}

export interface CalculatorTier {
  tier: InsuredTier
  enabled: boolean
  fee: number
  refund_value: number
  /** Null while the failure chance or the loss share is a hidden default (spec §6.4). */
  solo: CalculatorCase | null
  shared: CalculatorCase | null
  current: CalculatorCase | null
  in_sync: boolean | null
}

export interface LossPair {
  units: number
  alone: number
  shared: number
}

/** `POST /config/preview`: every figure of the host config screen, from the engine's own functions (spec §13.4, §13.10). */
export interface ConfigPreview {
  /** The hidden defaults the draft leaves blank; every figure that needs one is null (spec §9.3). */
  hidden: string[]
  weekdays: {
    days: { weekday: Weekday; multiplier: number; in_peak: boolean; market_demand: number }[]
    reach: number
    average_multiplier: number
    peak_demand_by_seats: { seats: number; units: number }[]
  }
  game: {
    weekly_cycles: number
    last_weekday: Weekday
    own_demand_per_day: number
    cost_per_day: number
    days_covered: number
  }
  prices: {
    spot_low: number
    spot_high: number
    margin_at_low: number
    margin_at_high: number
    backlog_cost: { days: number; cost: number }[]
  }
  reputation: {
    starting_shares: { alias: string; share: number }[]
    clean_days: number[]
    day_scores: { fill: number; scores: { waste: number; score: number }[] }[]
    split: { reputation: number; share: number; units: number }[]
  }
  supplier: {
    expected_capacity: number
    disrupted_capacity: number
    capacity_band: { low: number; high: number } | null
    disruptions: { chance_any: number; expected: number } | null
    lead_time: { arrival_day: number; arrival_weekday: Weekday; last_spot_day: number }
    initial_pipeline: { used: boolean; arrivals: { day: number; units: number }[] }
    futures: { delivery_day: number; last_day_to_buy: number }
  }
  stock: {
    quality_step_per_night: number
    quality_range: PreviewLot[]
    highest_lot: PreviewLot
    plain_vs_conserved: PreviewLot[]
    spoil_risk: PreviewLot[]
    holding: { units: number; cost: number }
    salvage: { units: number; revenue: number }
    conservation: { units: number; cost: number; risk_after_fresh: number; units_saved: number }
    quality_guide: QualityGuideRow[]
  }
  transport: {
    shipping: { units: number; cost: number }
    failures: { chance_any: number; expected: number } | null
    loss_example: LossPair | null
    loss_table: {
      shared_by: number
      shared_fraction: number
      rows: { alias: string; shipped: number; alone: number; shared: number }[]
      total_alone: number
      total_shared: number
    } | null
    reference_losses: LossPair | null
  }
  calculator: {
    known: boolean
    shared_seats: number
    target_ratio: number
    tiers: CalculatorTier[]
  }
  examples: {
    allocation: {
      capacity: number
      orders: Record<string, number>
      largest_first: Record<string, number>
      cooperative: Record<string, number>
    }
    peer_trades: { buyer: string; seller: string; seller_lot: string; units: number; price: number; total: number }[]
  }
}

export interface ConfigPreviewResponse {
  preview: ConfigPreview | null
}
