import type { JoinErrorPayload } from '../types/game'

/**
 * Lets one mounted screen take a `join_error` before the store turns it into a global
 * alert. Only the multi-game dashboard uses it: a refused `start_game` carries the
 * `room_code` it named (spec §11.3, §12.2), and the dashboard shows it on that game's
 * card. A claimer returns true when it took the refusal; anything it leaves goes to
 * the store as before. Components never call `socket.on` (see `socketHandlers.ts`).
 */
type JoinErrorClaimer = (p: JoinErrorPayload) => boolean

let claimer: JoinErrorClaimer | null = null

/** Take `join_error`s while mounted; returns the release for the effect's cleanup. */
export function claimJoinErrors(fn: JoinErrorClaimer): () => void {
  claimer = fn
  return () => {
    if (claimer === fn) claimer = null
  }
}

/** Called by the `join_error` listener: true when a claimer took this refusal. */
export function routeJoinError(p: JoinErrorPayload): boolean {
  return claimer?.(p) ?? false
}
