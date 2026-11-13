import http from './http'
import type {
  BatchCreateResponse,
  CreateRoomResponse,
  GameConfig,
  HostedRoom,
  RoomStatus,
  RoomSummary,
  RoomsSummaryResponse,
} from '../types/game'

export async function createRoom(hostDisplayName?: string): Promise<CreateRoomResponse> {
  const body = hostDisplayName ? { host_display_name: hostDisplayName } : {}
  const res = await http.post<CreateRoomResponse>('/rooms/create', body)
  return res.data
}

/**
 * `count` rooms that all start with `configPatch` (a patch over the defaults), for the
 * multi-game host dashboard. The server validates the config once before making any
 * room: a refusal is the config save's 400 and creates nothing. Each room counts
 * against the per-IP room-create limit (spec §0.6). Every room in the answer carries
 * its `host_secret`; store each with `setHostSecret` and never log the response.
 */
export async function createRoomBatch(
  count: number,
  configPatch: object,
  hostDisplayName?: string,
): Promise<BatchCreateResponse> {
  const body = hostDisplayName
    ? { count, config: configPatch, host_display_name: hostDisplayName }
    : { count, config: configPatch }
  const res = await http.post<BatchCreateResponse>('/rooms/batch-create', body)
  return res.data
}

/**
 * State, seats, day and `can_start` for each room this tab hosts, in order. A POST so
 * the secrets stay out of URLs; read-only on the server, so polling it does not keep
 * an unstarted room alive.
 */
export async function getRoomsSummary(rooms: HostedRoom[]): Promise<RoomSummary[]> {
  const res = await http.post<RoomsSummaryResponse>('/rooms/summary', { rooms })
  return res.data.rooms
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
