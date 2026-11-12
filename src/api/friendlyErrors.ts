/**
 * The words the player reads for the server's refusals (spec §0.6 abuse limits, §11.3 room
 * expiry). REST (`errorMessage`), the socket's `error`/`join_error` (the store) and the
 * handshake (`socketHandlers`) all take their copy from here.
 */

/** The backend's own copy, matched where the payload carries no code. */
const SERVER_ROOM_NOT_FOUND = 'No room with that code.'
const SERVER_TOO_MANY_REQUESTS = 'Too many requests. Wait a minute and try again.'
const SERVER_TOO_MANY_ROOMS = 'Too many games are open right now. Try again in a few minutes.'

export const ROOM_GONE_MESSAGE = 'This room has expired or does not exist.'
export const RATE_LIMITED_MESSAGE =
  'Too many requests from your network. Please wait a minute and try again.'
export const TOO_LARGE_MESSAGE = 'That request was too large.'
export const SERVER_BUSY_MESSAGE = 'The server is busy right now — please try again in a minute.'
export const TOO_MANY_ROOMS_MESSAGE =
  'Too many games are running right now — please try again in a few minutes.'
export const TOO_MANY_CONNECTIONS_MESSAGE = 'Too many connections from your network. Retrying…'

/**
 * The handshake's refusal at the per-IP socket cap, exactly as the server sends it
 * (`ConnectionRefusedError`, `connect_error` `err.message`). A token that fails
 * verification is refused with Socket.IO's generic "Connection rejected by server".
 */
export const SOCKET_CAP_REFUSAL = 'Too many connections from your network. Try again in a minute.'

/** A 429's text; `retryAfter` is its `Retry-After` header, in seconds (an HTTP date is ignored). */
export function tooManyRequestsMessage(retryAfter: unknown): string {
  const raw = typeof retryAfter === 'number' ? String(retryAfter) : retryAfter
  const seconds = typeof raw === 'string' && /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : 0
  if (seconds <= 0) return RATE_LIMITED_MESSAGE
  return `Too many requests from your network. Please wait about ${seconds} seconds and try again.`
}

/** A 503's text: the live-room cap by its detail, else the server's own detail, else "busy". */
export function serviceUnavailableMessage(detail: unknown): string {
  if (detail === SERVER_TOO_MANY_ROOMS) return TOO_MANY_ROOMS_MESSAGE
  if (typeof detail === 'string' && detail.trim()) return detail
  return SERVER_BUSY_MESSAGE
}

/** A server message as shown: a room gone (expired after 2 h unstarted, or never there) and the rate limit reworded. */
export function serverMessageText(message: string): string {
  if (message === SERVER_ROOM_NOT_FOUND) return ROOM_GONE_MESSAGE
  if (message === SERVER_TOO_MANY_REQUESTS) return RATE_LIMITED_MESSAGE
  return message
}

/** A socket `error` or `join_error` as shown; `join_error` carries no code, so its message decides. */
export function socketErrorText(p: { code?: string; message: string }): string {
  if (p.code === 'RATE_LIMITED') return RATE_LIMITED_MESSAGE
  return serverMessageText(p.message)
}
