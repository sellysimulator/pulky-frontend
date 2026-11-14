import http from './http'
import type { ResultsResponse } from '../types/game'

export async function getResultsById(gameId: string): Promise<ResultsResponse> {
  const res = await http.get<ResultsResponse>(`/games/id/${gameId}/results`)
  return res.data
}

/** Open by game id, like the results (spec §13.4): no host secret; a 429 past the server's per-IP limit. */
export async function exportGame(gameId: string, format: 'csv' | 'json'): Promise<Blob> {
  const res = await http.get<Blob>(`/games/id/${gameId}/export`, {
    params: { format },
    responseType: 'blob',
  })
  return res.data
}

export async function claimGames(guestIdentity: string): Promise<{ claimed: number }> {
  const res = await http.post<{ claimed: number }>('/games/claim', {
    guest_identity: guestIdentity,
  })
  return res.data
}
