import http from './http'
import type { ConfigDefaultsResponse, GameConfig, ValidateConfigResponse } from '../types/game'

export async function getConfigDefaults(): Promise<ConfigDefaultsResponse> {
  const res = await http.get<ConfigDefaultsResponse>('/config/defaults')
  return res.data
}

export async function validateConfig(config: GameConfig): Promise<ValidateConfigResponse> {
  const res = await http.post<ValidateConfigResponse>('/config/validate', { config })
  return res.data
}
