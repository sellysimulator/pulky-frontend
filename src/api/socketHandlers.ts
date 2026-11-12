/**
 * One listener per server event of spec §12.2, registered as a module side
 * effect. `main.tsx` imports this before React renders; no component calls
 * `socket.on` (a handler registered in a component runs twice under StrictMode).
 */
import { socket } from './socket'
import { SOCKET_CAP_REFUSAL, TOO_MANY_CONNECTIONS_MESSAGE } from './friendlyErrors'
import { join, joinWaiting } from './games'
import { useGameStore } from '../store/gameStore'
import {
  clearSessionToken,
  getDisplayName,
  getHostSecret,
  getSessionToken,
  markGamePlayed,
  setGameHostSecret,
  setHostSecret,
  setSessionToken,
} from '../utils/storage'
import type {
  ConfigUpdatedPayload,
  DayClosedPayload,
  DayOpenedPayload,
  DecisionSubmittedPayload,
  GameFinishedPayload,
  GamePersistedPayload,
  GameStartedPayload,
  HostClaimedPayload,
  HostDisconnectedPayload,
  HostReconnectedPayload,
  HostStatePayload,
  JoinedPayload,
  JoinErrorPayload,
  LeaveAckPayload,
  LobbyUpdatePayload,
  ParticipantDisconnectedPayload,
  ParticipantReconnectedPayload,
  ServerError,
  YourDayClosedPayload,
  YourStatePayload,
} from '../types/game'

const CONNECT_ERROR_MESSAGE = 'Could not reach the game server.'

/** The results page and export find this game by id; the room code is reissued later. */
function rememberFinishedGame(gameId: string): void {
  const { roomCode, myAlias } = store()
  if (roomCode === null) return
  const hostSecret = getHostSecret(roomCode)
  if (hostSecret !== null) setGameHostSecret(gameId, hostSecret)
  if (myAlias !== null) markGamePlayed(gameId)
}

const store = () => useGameStore.getState()

/** Backoff after a refusal at the per-IP socket cap (spec §0.6): 2 s, doubling, at most 30 s. */
const CAP_RETRY_FIRST_MS = 2000
const CAP_RETRY_MAX_MS = 30_000

let capRetries = 0
let capRetryTimer: ReturnType<typeof setTimeout> | null = null
let capAlertId: string | null = null

/** One alert per distinct message, however many times the handshake fails. */
function showConnectionError(message: string): string | null {
  if (store().connectionError === message) return null
  store().setConnectionError(message)
  return store().addAlert({ kind: 'error', message })
}

/**
 * socket.io-client v4 retries a failed transport by itself (`socket.active` stays true),
 * but not a handshake the server refused: that one is retried here, on a bounded backoff.
 */
function retryAfterCap(): void {
  capAlertId = showConnectionError(TOO_MANY_CONNECTIONS_MESSAGE) ?? capAlertId
  if (capRetryTimer !== null) return
  const delay = Math.min(CAP_RETRY_FIRST_MS * 2 ** capRetries, CAP_RETRY_MAX_MS)
  capRetries += 1
  capRetryTimer = setTimeout(() => {
    capRetryTimer = null
    if (!socket.active) socket.connect()
  }, delay)
}

socket.on('connect', () => {
  const { roomCode, isHost } = store()
  capRetries = 0
  if (capRetryTimer !== null) clearTimeout(capRetryTimer)
  capRetryTimer = null
  if (capAlertId !== null) store().dismissAlert(capAlertId)
  capAlertId = null
  store().setConnectionError(null)
  if (!roomCode) return
  if (isHost) {
    joinWaiting(roomCode, getHostSecret(roomCode))
    return
  }
  const token = getSessionToken(roomCode)
  if (token !== null) join(roomCode, getDisplayName(), token)
})

socket.on('connect_error', (err: Error) => {
  // The cap names itself; any other refusal (a token that fails verification) is not retried.
  if (err?.message === SOCKET_CAP_REFUSAL && !socket.active) {
    retryAfterCap()
    return
  }
  showConnectionError(CONNECT_ERROR_MESSAGE)
})

socket.on('joined', (p: JoinedPayload) => {
  const { roomCode } = store()
  if (roomCode) setSessionToken(roomCode, p.session_token)
  store().applyJoined(p)
})

socket.on('host_claimed', (p: HostClaimedPayload) => {
  const code = p.room_id || store().roomCode
  if (code) setHostSecret(code, p.host_secret)
  store().applyHostClaimed(p)
})

socket.on('join_error', (p: JoinErrorPayload) => store().applyJoinError(p))

socket.on('leave_ack', (p: LeaveAckPayload) => {
  const code = p.room_id || store().roomCode
  if (code) clearSessionToken(code)
  store().applyLeaveAck(p)
})

socket.on('lobby_update', (p: LobbyUpdatePayload) => store().applyLobbyUpdate(p))
socket.on('config_updated', (p: ConfigUpdatedPayload) => store().applyConfigUpdated(p))
socket.on('game_started', (p: GameStartedPayload) => store().applyGameStarted(p))
socket.on('day_opened', (p: DayOpenedPayload) => store().applyDayOpened(p))
socket.on('your_state', (p: YourStatePayload) => store().applyYourState(p))
socket.on('host_state', (p: HostStatePayload) => store().applyHostState(p))
socket.on('decision_submitted', (p: DecisionSubmittedPayload) =>
  store().applyDecisionSubmitted(p),
)
socket.on('day_closed', (p: DayClosedPayload) => store().applyDayClosed(p))
socket.on('your_day_closed', (p: YourDayClosedPayload) => store().applyYourDayClosed(p))
socket.on('participant_disconnected', (p: ParticipantDisconnectedPayload) =>
  store().applyParticipantDisconnected(p),
)
socket.on('participant_reconnected', (p: ParticipantReconnectedPayload) =>
  store().applyParticipantReconnected(p),
)
socket.on('host_disconnected', (p: HostDisconnectedPayload) => store().applyHostDisconnected(p))
socket.on('host_reconnected', (p: HostReconnectedPayload) => store().applyHostReconnected(p))
socket.on('game_finished', (p: GameFinishedPayload) => {
  rememberFinishedGame(p.game_id)
  store().applyGameFinished(p)
})
socket.on('game_persisted', (p: GamePersistedPayload) => store().applyGamePersisted(p))
socket.on('error', (p: ServerError) => store().applyError(p))
