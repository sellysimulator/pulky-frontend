import http from './http'
import type { ResultsResponse } from '../types/game'

export async function getResultsById(gameId: string): Promise<ResultsResponse> {
  const res = await http.get<ResultsResponse>(`/games/id/${gameId}/results`)
  return res.data
}

export async function exportGame(
  gameId: string,
  format: 'csv' | 'json',
  hostSecret: string | null,
): Promise<Blob> {
  const res = await http.get<Blob>(`/games/id/${gameId}/export`, {
    params: { format },
    responseType: 'blob',
    headers: hostSecret !== null ? { 'X-Host-Secret': hostSecret } : {},
  })
  return res.data
}

export async function claimGames(guestIdentity: string): Promise<{ claimed: number }> {
  const res = await http.post<{ claimed: number }>('/games/claim', {
    guest_identity: guestIdentity,
  })
  return res.data
}
