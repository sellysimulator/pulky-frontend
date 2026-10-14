import http from './http'
import type { MyGameResponse, MyGameRow, UserMe, UserStats } from '../types/game'

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

export async function getMyGame(gameId: string): Promise<MyGameResponse> {
  const res = await http.get<MyGameResponse>(`/users/me/games/${gameId}`)
  return res.data
}
