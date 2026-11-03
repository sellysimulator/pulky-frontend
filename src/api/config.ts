import http from './http'
import { useGameStore } from '../store/gameStore'
import type { ConfigDefaultsResponse, GameConfig, Limits, ValidateConfigResponse } from '../types/game'

export async function getConfigDefaults(): Promise<ConfigDefaultsResponse> {
  const res = await http.get<ConfigDefaultsResponse>('/config/defaults')
  return res.data
}

export async function validateConfig(config: GameConfig): Promise<ValidateConfigResponse> {
  const res = await http.post<ValidateConfigResponse>('/config/validate', { config })
  return res.data
}

let pending: Promise<void> | null = null

/**
 * Spec §13.6: reads the backend's hard limits from `GET /config/defaults` into the
 * store, once per page load; the client keeps no copy of them. Concurrent calls
 * share one request, and a failed load is tried again on the next call.
 */
export function loadLimits(): Promise<void> {
  if (useGameStore.getState().limits !== null) return Promise.resolve()
  pending ??= getConfigDefaults()
    .then((d) => useGameStore.getState().setLimits(d.limits))
    .catch(() => undefined)
    .finally(() => {
      pending = null
    })
  return pending
}

/**
 * The backend's hard limits, or null until `loadLimits` (run by `RequireBackend` once the
 * backend is awake) has stored them; a form then checks no upper bound. Reading them
 * never requests anything, so mounting a form or switching board views stays silent.
 */
export function useLimits(): Limits | null {
  return useGameStore((s) => s.limits)
}
