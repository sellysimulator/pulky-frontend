/**
 * One listener per server event of spec §12.2, registered as a module side
 * effect. `main.tsx` imports this before React renders; no component calls
 * `socket.on` (a handler registered in a component runs twice under StrictMode).
 */
import { socket } from './socket'
import { join, joinWaiting } from './games'
import { useGameStore } from '../store/gameStore'
import {
  clearSessionToken,
  getDisplayName,
  getHostSecret,
  getSessionToken,
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

const store = () => useGameStore.getState()

socket.on('connect', () => {
  const { roomCode, isHost } = store()
  store().setConnectionError(null)
  if (!roomCode) return
  if (isHost) {
    joinWaiting(roomCode, getHostSecret(roomCode))
    return
  }
  const token = getSessionToken(roomCode)
  if (token !== null) join(roomCode, getDisplayName(), token)
})

socket.on('connect_error', () => {
  if (store().connectionError !== null) return
  store().setConnectionError(CONNECT_ERROR_MESSAGE)
  store().addAlert({ kind: 'error', message: CONNECT_ERROR_MESSAGE })
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
socket.on('game_finished', (p: GameFinishedPayload) => store().applyGameFinished(p))
socket.on('game_persisted', (p: GamePersistedPayload) => store().applyGamePersisted(p))
socket.on('error', (p: ServerError) => store().applyError(p))
