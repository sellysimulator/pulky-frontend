/** The "See the results" link (spec §13.8): by game id only, never by room code. */
export function resultsPath(gameId: string): string {
  return `/results/${gameId}`
}
