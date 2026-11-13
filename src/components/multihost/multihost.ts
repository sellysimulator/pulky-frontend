import type { HostedRoom, RoomSummary } from '../../types/game'
import { getHostSecret } from '../../utils/storage'

/**
 * Helpers for the multi-game host dashboard (`pages/MultiHostDashboard.tsx`).
 * A plain `.ts` module: component files export only their component.
 */

/** The rooms of a batch with the secret this tab holds for each. A room whose secret
 * is missing is sent with an empty one, so the server answers `exists: false` for it
 * rather than the dashboard dropping it silently. */
export function hostedRooms(roomCodes: string[]): HostedRoom[] {
  return roomCodes.map((room_code) => ({ room_code, host_secret: getHostSecret(room_code) ?? '' }))
}

/** The host screen of a room. */
export function hostScreenPath(roomCode: string): string {
  return `/host/${encodeURIComponent(roomCode)}`
}

/**
 * Open a room's host screen (`/host/:roomCode`) in a new tab.
 *
 * Each game gets its own tab because the host screen holds one room per tab: one
 * socket, one store. `window.open` WITHOUT `noopener` makes the browser copy this
 * tab's session storage into the new one, so it starts with every
 * `pulky.host_secret.<CODE>` the dashboard stored and claims the room with it. With
 * `noopener` (or an `<a target="_blank">`) it would start empty and could not claim
 * the room. Pulky keeps no "am I the host" flag: the secret is the whole claim.
 */
export function openHostScreen(roomCode: string): void {
  window.open(hostScreenPath(roomCode), '_blank')
}

/** The card's one-line status, from the server's summary of the room. */
export function statusLabel(summary: RoomSummary | undefined): string {
  if (!summary) return 'Loading…'
  if (!summary.exists) return 'Expired or not found'
  if (summary.finished) return 'Finished'
  if (summary.state === 'running') return `Day ${summary.day} of ${summary.duration_days}`
  if (summary.can_start) return 'Ready to start'
  return 'Waiting for players'
}

/** The rooms "Start all ready games" would start: those the server says can start. */
export function readyRooms(rooms: HostedRoom[], summaries: Record<string, RoomSummary>): HostedRoom[] {
  return rooms.filter(({ room_code }) => summaries[room_code]?.can_start === true)
}
