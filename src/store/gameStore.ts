/**
 * The single source of truth. Written only by the socket handlers
 * (src/api/socketHandlers.ts) and the REST loaders that call `setConfig` and
 * `setLimits` (src/api/config.ts).
 */
import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { RATE_LIMITED_MESSAGE, socketErrorText } from '../api/friendlyErrors'
import type {
  ConfigUpdatedPayload,
  DayClosedPayload,
  DayOpenedPayload,
  DayRecord,
  DecisionSubmittedPayload,
  GameConfig,
  GameFinishedPayload,
  GamePersistedPayload,
  GameStartedPayload,
  HostClaimedPayload,
  HostDisconnectedPayload,
  HostReconnectedPayload,
  HostStatePayload,
  HostView,
  JoinedPayload,
  JoinErrorPayload,
  LeaveAckPayload,
  Limits,
  LobbyUpdatePayload,
  MarketDay,
  Participant,
  ParticipantDisconnectedPayload,
  ParticipantReconnectedPayload,
  PlayerView,
  PublicConfig,
  PublicDayResults,
  RoomState,
  ServerError,
  Brief,
  YourDayClosedPayload,
  YourStatePayload,
} from '../types/game'

export interface Alert {
  id: string
  kind: 'info' | 'success' | 'error'
  message: string
}

export interface GameState {
  roomCode: string | null
  isHost: boolean
  myAlias: string | null
  roomState: RoomState | null
  participants: Participant[]
  seatsTotal: number | null
  configLocked: boolean
  canStart: boolean
  startBlockedReason: string | null
  joinError: string | null
  hostClaimed: boolean
  hostConnected: boolean
  config: GameConfig | PublicConfig | null
  durationDays: number | null
  lastSeq: number
  brief: Brief | null
  playerView: PlayerView | null
  hostView: HostView | null
  submittedAliases: string[]
  awaiting: string[]
  lastDayClosed: DayClosedPayload | null
  lastRecord: DayRecord | null
  ownHistory: DayRecord[]
  publicHistory: PublicDayResults[]
  hostHistories: Record<string, DayRecord[]>
  /** Each player's profit so far after each day, as the server sent it (spec §12.5): the host's profit race. */
  hostRace: Record<string, number[]>
  marketHistory: MarketDay[]
  finished: GameFinishedPayload | null
  gamePublicId: string | null
  alerts: Alert[]
  /** The day chosen under Your profit per day; board UI state, written only by the board through selectDay. */
  selectedDay: number | null
  connectionError: string | null
  lastError: ServerError | null
  /** The backend's hard limits (spec §9.2), loaded once per page by `loadLimits`; null until then. */
  limits: Limits | null
}

export interface GameActions {
  setRoom(roomCode: string, isHost: boolean): void
  reset(): void
  applyJoined(p: JoinedPayload): void
  applyHostClaimed(p: HostClaimedPayload): void
  applyJoinError(p: JoinErrorPayload): void
  clearJoinError(): void
  applyLeaveAck(p: LeaveAckPayload): void
  applyLobbyUpdate(p: LobbyUpdatePayload): void
  applyConfigUpdated(p: ConfigUpdatedPayload): void
  applyGameStarted(p: GameStartedPayload): void
  applyDayOpened(p: DayOpenedPayload): void
  applyYourState(p: YourStatePayload): void
  applyHostState(p: HostStatePayload): void
  applyDecisionSubmitted(p: DecisionSubmittedPayload): void
  applyDayClosed(p: DayClosedPayload): void
  applyYourDayClosed(p: YourDayClosedPayload): void
  applyParticipantDisconnected(p: ParticipantDisconnectedPayload): void
  applyParticipantReconnected(p: ParticipantReconnectedPayload): void
  applyHostDisconnected(p: HostDisconnectedPayload): void
  applyHostReconnected(p: HostReconnectedPayload): void
  applyGameFinished(p: GameFinishedPayload): void
  applyGamePersisted(p: GamePersistedPayload): void
  applyError(p: ServerError): void
  clearLastError(): void
  setConfig(config: GameConfig | PublicConfig): void
  setLimits(limits: Limits): void
  setConnectionError(message: string | null): void
  addAlert(a: Omit<Alert, 'id'>): string
  dismissAlert(id: string): void
  selectDay(day: number | null): void
}

export const INITIAL_STATE: GameState = {
  roomCode: null,
  isHost: false,
  myAlias: null,
  roomState: null,
  participants: [],
  seatsTotal: null,
  configLocked: false,
  canStart: false,
  startBlockedReason: null,
  joinError: null,
  hostClaimed: false,
  hostConnected: true,
  config: null,
  durationDays: null,
  lastSeq: 0,
  brief: null,
  playerView: null,
  hostView: null,
  submittedAliases: [],
  awaiting: [],
  lastDayClosed: null,
  lastRecord: null,
  ownHistory: [],
  publicHistory: [],
  hostHistories: {},
  hostRace: {},
  marketHistory: [],
  finished: null,
  gamePublicId: null,
  alerts: [],
  selectedDay: null,
  connectionError: null,
  lastError: null,
  limits: null,
}

/** Spec §12.6 append rule: an entry is added only when its `day` is later than the last one held. */
function appendByDay<T extends { day: number }>(list: T[], entry: T): T[] {
  const last = list[list.length - 1]
  if (last !== undefined && entry.day <= last.day) return list
  return [...list, entry]
}

/** Host rule (spec §3.2): a host never loses a key players do not see. */
function nextConfig(
  state: GameState,
  incoming: GameConfig | PublicConfig,
): GameConfig | PublicConfig | null {
  if (state.isHost && !('random_seed' in incoming)) return state.config
  return incoming
}

export const useGameStore = create<GameState & GameActions>()((set, get) => {
  /** Spec §12 seq gate: applies `fn` only when `seq` is newer than `lastSeq`. */
  const sequenced = (
    seq: number,
    fn: (state: GameState) => Partial<GameState>,
  ): void => {
    const state = get()
    if (seq <= state.lastSeq) return
    set({ ...fn(state), lastSeq: seq })
  }

  // Over the abuse limits every event is refused (spec §0.6): one alert says so, not one per event.
  const errorAlert = (message: string): void => {
    if (message === RATE_LIMITED_MESSAGE && get().alerts.some((a) => a.message === message)) return
    get().addAlert({ kind: 'error', message })
  }

  return {
    ...INITIAL_STATE,

    // The limits belong to the server, not to a room: leaving a room keeps them.
    setRoom: (roomCode, isHost) => {
      if (get().roomCode !== roomCode) set({ ...INITIAL_STATE, roomCode, isHost, limits: get().limits })
      else set({ isHost })
    },

    reset: () => set({ ...INITIAL_STATE, limits: get().limits }),

    applyJoined: (p) => set({ myAlias: p.alias, joinError: null }),

    applyHostClaimed: () => set({ hostClaimed: true, joinError: null }),

    applyJoinError: (p) => {
      const message = socketErrorText(p)
      set({ joinError: message })
      errorAlert(message)
    },

    clearJoinError: () => set({ joinError: null }),

    applyLeaveAck: () => set({ myAlias: null }),

    applyLobbyUpdate: (p) =>
      sequenced(p.seq, () => ({
        roomState: p.state,
        participants: p.participants,
        seatsTotal: p.seats_total,
        configLocked: p.config_locked,
        canStart: p.can_start,
        startBlockedReason: p.start_blocked_reason,
      })),

    applyConfigUpdated: (p) =>
      sequenced(p.seq, (state) => ({ config: nextConfig(state, p.config) })),

    applyGameStarted: (p) =>
      sequenced(p.seq, (state) => ({
        config: nextConfig(state, p.config),
        durationDays: p.duration_days,
        participants: p.participants,
        roomState: 'running',
      })),

    applyDayOpened: (p) =>
      sequenced(p.seq, () => ({ brief: p.brief, submittedAliases: [] })),

    applyYourState: (p) =>
      sequenced(p.seq, () => {
        const next: Partial<GameState> = { playerView: p, awaiting: p.awaiting }
        if (p.full) {
          const own = p.own_history ?? []
          next.ownHistory = own
          next.publicHistory = p.public_history ?? []
          next.lastRecord = own.length > 0 ? own[own.length - 1] : null
        }
        return next
      }),

    applyHostState: (p) =>
      sequenced(p.seq, (state) => {
        const next: Partial<GameState> = {
          hostView: p,
          config: p.config,
          roomState: p.state,
          durationDays: p.duration_days,
          awaiting: p.awaiting,
        }
        if (p.full) {
          const histories: Record<string, DayRecord[]> = {}
          const race: Record<string, number[]> = {}
          for (const [alias, row] of Object.entries(p.players)) {
            histories[alias] = row.own_history ?? []
            race[alias] = row.cumulative_profit_by_day ?? []
          }
          next.hostHistories = histories
          next.hostRace = race
          next.publicHistory = p.public_history ?? []
          next.marketHistory = p.market_history ?? []
        } else {
          const histories = { ...state.hostHistories }
          const race = { ...state.hostRace }
          for (const [alias, row] of Object.entries(p.players)) {
            if (row.last_record) {
              histories[alias] = appendByDay(histories[alias] ?? [], row.last_record)
              // The day's point is the server's cumulative profit; a gap waits for the next full state.
              const points = race[alias] ?? []
              if (points.length === row.last_record.day - 1) race[alias] = [...points, row.cumulative_profit]
            }
          }
          next.hostHistories = histories
          next.hostRace = race
          if (p.last_market_day) {
            next.marketHistory = appendByDay(state.marketHistory, p.last_market_day)
          }
        }
        return next
      }),

    applyDecisionSubmitted: (p) =>
      sequenced(p.seq, (state) => ({
        submittedAliases: state.submittedAliases.includes(p.alias)
          ? state.submittedAliases
          : [...state.submittedAliases, p.alias],
        awaiting: p.awaiting,
      })),

    applyDayClosed: (p) =>
      sequenced(p.seq, (state) => ({
        lastDayClosed: p,
        publicHistory: appendByDay(state.publicHistory, p.public),
      })),

    applyYourDayClosed: (p) =>
      sequenced(p.seq, (state) => ({
        lastRecord: p.record,
        ownHistory: appendByDay(state.ownHistory, p.record),
      })),

    applyParticipantDisconnected: (p) =>
      sequenced(p.seq, (state) => ({
        participants: state.participants.map((x) =>
          x.alias === p.alias ? { ...x, connected: false } : x,
        ),
      })),

    applyParticipantReconnected: (p) =>
      sequenced(p.seq, (state) => ({
        participants: state.participants.map((x) =>
          x.alias === p.alias ? { ...x, connected: true } : x,
        ),
      })),

    applyHostDisconnected: (p) => sequenced(p.seq, () => ({ hostConnected: false })),

    applyHostReconnected: (p) => sequenced(p.seq, () => ({ hostConnected: true })),

    applyGameFinished: (p) =>
      sequenced(p.seq, () => ({ finished: p, roomState: 'finished', gamePublicId: p.game_id })),

    applyGamePersisted: (p) => sequenced(p.seq, () => ({ gamePublicId: p.game_id })),

    applyError: (p) => {
      set({ lastError: p })
      if (p.code === 'GAME_FINISHED') return
      if (p.code === 'STALE_DAY') get().addAlert({ kind: 'success', message: p.message })
      else errorAlert(socketErrorText(p))
    },

    clearLastError: () => set({ lastError: null }),

    setConfig: (config) => set({ config }),

    setLimits: (limits) => set({ limits }),

    setConnectionError: (message) => set({ connectionError: message }),

    addAlert: (a) => {
      const id = uuidv4()
      set((state) => ({ alerts: [...state.alerts, { ...a, id }] }))
      return id
    },

    dismissAlert: (id) =>
      set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) })),

    selectDay: (day) => set({ selectedDay: day }),
  }
})
