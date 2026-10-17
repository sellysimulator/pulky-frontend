/**
 * Wire types for Pulky. Hand-written, one place, snake_case exactly as on the
 * wire (spec §2, §12; backend contracts of sections 03, 04, 10, 11, 13-16, 19).
 */

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
/** Monday first: the order of the weekday index (spec §7.1) and of every weekday row. */
export const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/** An Incoterm tier by its id: the per-shipment contract that decides whether, and at
 * what value, lost units are refunded (spec §6.3). The names only borrow Incoterms'. */
export type IncotermTier = 'exw' | 'cip' | 'dap' | 'ddp'
/** The tiers that refund lost units: the host can disable them and set their fees. */
export type InsuredTier = Exclude<IncotermTier, 'exw'>
/** Every tier, from no protection to the most (spec §6.3's order). */
export const INCOTERM_TIERS: readonly IncotermTier[] = ['exw', 'cip', 'dap', 'ddp']
export const INSURED_TIERS: readonly InsuredTier[] = ['cip', 'dap', 'ddp']
export type RoomState = 'lobby' | 'configuring' | 'running' | 'finished'
export type Phase = 'deciding' | 'finished'
export type TradeSide = 'buy' | 'sell'

/** Hard limits the UI needs (spec §9.2). */
export const LIMITS = {
  MAX_PLAYERS: 12,
  MAX_ORDER: 9999,
  MAX_DISPLAY_NAME: 24,
  MAX_CONSERVE_LOTS: 30,
  MAX_PEER_PRICE: 10000,
} as const

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
    capacity_sd_per_player: number
    disruption_probability: number
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
    failure_probability: number
    loss_fraction: number
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
}

export interface ConfigDefaultsResponse {
  config: GameConfig
  fields: Record<string, ConfigFieldMeta>
  limits: Record<string, number>
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
    capacity: number
    disrupted: boolean
    disruption_message: string | null
    spot_price: number
    base_price: number
    lead_time_days: number
  }
  spot: { open: boolean; arrives_day: number }
  futures: {
    open: boolean
    price: number
    horizon_days: number
    delivery_day: number
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
  capacity: number
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

/** Spec §12.4 tier plan row, one per Incoterm tier (no refund range). */
export interface IncotermTierPlan {
  tier: IncotermTier
  label: string
  enabled: boolean
  refund_basis: string
  refund_value_today: number | null
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
  last_day: number
  risk_tonight: number
  expected_loss_tonight: number
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
  order_windows: OrderWindows
  prefill_decision: Decision
  own_history?: DayRecord[]
  public_history?: PublicDayResults[]
  final_settlement: FinalSettlement | null
}

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
    cooperate: boolean[]
  }
  final_settlement: FinalSettlement
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

export interface ServerError {
  code: ErrorCode | string
  message: string
  field?: string
}
