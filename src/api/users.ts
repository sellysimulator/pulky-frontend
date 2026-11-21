import http from './http'
import type { HostedGameRow, MyGameResponse, MyGameRow, UserMe, UserStats } from '../types/game'

export async function upsertUser(displayName?: string): Promise<UserMe> {
  const body = displayName ? { display_name: displayName } : {}
  const res = await http.post<UserMe>('/users/upsert', body)
  return res.data
}

export async function getMe(): Promise<UserMe> {
  const res = await http.get<UserMe>('/users/me')
  return res.data
}

export async function getMyStats(): Promise<UserStats> {
  const res = await http.get<UserStats>('/users/me/stats')
  return res.data
}

export async function getMyGames(): Promise<MyGameRow[]> {
  const res = await http.get<{ games: MyGameRow[] }>('/users/me/games')
  return res.data.games
}

/** The games the user hosted signed in (spec §13.4); never part of the played games or stats. */
export async function getMyHostedGames(): Promise<HostedGameRow[]> {
  const res = await http.get<{ games: HostedGameRow[] }>('/users/me/hosted-games')
  return res.data.games
}

export async function getMyGame(gameId: string): Promise<MyGameResponse> {
  const res = await http.get<MyGameResponse>(`/users/me/games/${gameId}`)
  return res.data
}
