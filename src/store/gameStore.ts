/**
 * The single source of truth. Written only by the socket handlers
 * (src/api/socketHandlers.ts) and the REST loaders that call `setConfig`.
 */
import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
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
  marketHistory: MarketDay[]
  finished: GameFinishedPayload | null
  gamePublicId: string | null
  alerts: Alert[]
  connectionError: string | null
  lastError: ServerError | null
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
  setConnectionError(message: string | null): void
  addAlert(a: Omit<Alert, 'id'>): string
  dismissAlert(id: string): void
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
  marketHistory: [],
  finished: null,
  gamePublicId: null,
  alerts: [],
  connectionError: null,
  lastError: null,
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

  return {
    ...INITIAL_STATE,

    setRoom: (roomCode, isHost) => {
      if (get().roomCode !== roomCode) set({ ...INITIAL_STATE, roomCode, isHost })
      else set({ isHost })
    },

    reset: () => set({ ...INITIAL_STATE }),

    applyJoined: (p) => set({ myAlias: p.alias, joinError: null }),

    applyHostClaimed: () => set({ hostClaimed: true, joinError: null }),

    applyJoinError: (p) => {
      set({ joinError: p.message })
      get().addAlert({ kind: 'error', message: p.message })
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
          for (const [alias, row] of Object.entries(p.players)) {
            histories[alias] = row.own_history ?? []
          }
          next.hostHistories = histories
          next.publicHistory = p.public_history ?? []
          next.marketHistory = p.market_history ?? []
        } else {
          const histories = { ...state.hostHistories }
          for (const [alias, row] of Object.entries(p.players)) {
            if (row.last_record) {
              histories[alias] = appendByDay(histories[alias] ?? [], row.last_record)
            }
          }
          next.hostHistories = histories
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
      if (p.code !== 'GAME_FINISHED') get().addAlert({ kind: 'error', message: p.message })
    },

    clearLastError: () => set({ lastError: null }),

    setConfig: (config) => set({ config }),

    setConnectionError: (message) => set({ connectionError: message }),

    addAlert: (a) => {
      const id = uuidv4()
      set((state) => ({ alerts: [...state.alerts, { ...a, id }] }))
      return id
    },

    dismissAlert: (id) =>
      set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) })),
  }
})
