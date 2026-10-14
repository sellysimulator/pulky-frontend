import http from './http'
import type { CreateRoomResponse, GameConfig, RoomStatus } from '../types/game'

export async function createRoom(hostDisplayName?: string): Promise<CreateRoomResponse> {
  const body = hostDisplayName ? { host_display_name: hostDisplayName } : {}
  const res = await http.post<CreateRoomResponse>('/rooms/create', body)
  return res.data
}

export async function getRoomStatus(code: string): Promise<RoomStatus> {
  const res = await http.get<RoomStatus>(`/rooms/${code}/status`)
  return res.data
}

export async function getRoomConfig(code: string, hostSecret: string): Promise<GameConfig> {
  const res = await http.get<{ config: GameConfig }>(`/rooms/${code}/config`, {
    headers: { 'X-Host-Secret': hostSecret },
  })
  return res.data.config
}

export async function putRoomConfig(
  code: string,
  hostSecret: string,
  patch: object,
): Promise<GameConfig> {
  const res = await http.put<{ config: GameConfig }>(
    `/rooms/${code}/config`,
    { config: patch },
    { headers: { 'X-Host-Secret': hostSecret } },
  )
  return res.data.config
}
