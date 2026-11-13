/** The link a player opens to join a room (`/join/:roomCode`, `pages/JoinRedirect.tsx`). */
export function inviteLink(roomCode: string): string {
  return `${window.location.origin}/join/${roomCode.toUpperCase()}`
}
