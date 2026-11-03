import { socket } from './socket'
import type { Decision, DecisionDraft, DecisionPreviewAnswer } from '../types/game'

function withoutNulls(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null && v !== undefined))
}

export function joinWaiting(roomCode: string, hostSecret: string | null): void {
  socket.emit('join_waiting', withoutNulls({ room_id: roomCode, host_secret: hostSecret }))
}

export function join(
  roomCode: string,
  displayName: string | null,
  sessionToken: string | null,
): void {
  socket.emit(
    'join',
    withoutNulls({ room_id: roomCode, display_name: displayName, session_token: sessionToken }),
  )
}

export function leave(roomCode: string): void {
  socket.emit('leave', { room_id: roomCode })
}

export function updateConfig(roomCode: string, hostSecret: string, patch: object): void {
  socket.emit('config_update', { room_id: roomCode, host_secret: hostSecret, config: patch })
}

export function startGame(roomCode: string, hostSecret: string): void {
  socket.emit('start_game', { room_id: roomCode, host_secret: hostSecret })
}

/** Sends the decision exactly as given: `peer_buy: null` and `peer_sell: null` stay on the wire. */
export function submitDay(roomCode: string, decision: Decision): void {
  socket.emit('submit_day', { room_id: roomCode, ...decision })
}

export function endGameEarly(roomCode: string, hostSecret: string): void {
  socket.emit('end_game_early', { room_id: roomCode, host_secret: hostSecret })
}

export function requestState(roomCode: string): void {
  socket.emit('request_state', { room_id: roomCode })
}

/** How long a decision preview may take before the form gives up on it. */
export const PREVIEW_TIMEOUT_MS = 5000

/**
 * Spec §12.1: the decision form's figures for a draft, answered as the event's acknowledgement to this player
 * only. Rejects when the server does not answer in time.
 */
export function previewDecision(roomCode: string, decision: DecisionDraft): Promise<DecisionPreviewAnswer> {
  return socket.timeout(PREVIEW_TIMEOUT_MS).emitWithAck('preview_decision', { room_id: roomCode, decision }) as Promise<DecisionPreviewAnswer>
}
