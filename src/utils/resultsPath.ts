/** The "See the results" link (spec §13.8). */
export function resultsPath(roomCode: string, gamePublicId: string | null): string {
  if (gamePublicId) return `/results/g/${gamePublicId}`
  return `/results/${roomCode.toUpperCase()}`
}
