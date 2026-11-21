/**
 * The results link (spec §13.8): the stored game's public id only, never a room code or an
 * internal id, and it never expires.
 */
export function resultsPath(publicId: string): string {
  return `/results/${publicId}`
}
