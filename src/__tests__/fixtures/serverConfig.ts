/**
 * Test inputs read from the backend's own output, never typed by hand:
 * - `config_defaults.json` is `GET /config/defaults` (backend `config_schema()`): the
 *   host's default config, with null at each hidden default (spec §9.3), the field
 *   entries and the hard limits;
 * - `hidden_defaults.json` is the backend's values for those hidden defaults, which no
 *   endpoint serves before a game ends. Tests use them as a host's typed values, and
 *   to check that no public page ever states them.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useGameStore } from '../../store/gameStore'
import type { ConfigPreviewState } from '../../components/config/configPreview'
import type { ConfigDefaultsResponse, ConfigPreview, GameConfig, Limits } from '../../types/game'

function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), 'src/__tests__/fixtures', name), 'utf8')) as T
}

export const DEFAULTS_RESPONSE = fixture<ConfigDefaultsResponse>('config_defaults.json')

/** The limits `GET /config/defaults` serves. */
export const SERVER_LIMITS: Limits = DEFAULTS_RESPONSE.limits

/** The backend's hidden defaults, by dot path. */
export const HIDDEN_DEFAULTS = fixture<Record<string, number>>('hidden_defaults.json')

/** Stores the server's limits, as `RequireBackend`'s `loadLimits` does once the backend is awake. */
export function seedServerLimits(): void {
  useGameStore.setState({ limits: SERVER_LIMITS })
}

/** A config whose hidden defaults a host has typed in (with the backend's values), so every figure can be shown. */
export function withTypedRisks(config: GameConfig): GameConfig {
  const at = (path: string): number => HIDDEN_DEFAULTS[path]
  return {
    ...config,
    supplier: {
      ...config.supplier,
      capacity_sd_per_player: config.supplier.capacity_sd_per_player ?? at('supplier.capacity_sd_per_player'),
      disruption_probability: config.supplier.disruption_probability ?? at('supplier.disruption_probability'),
    },
    transport: {
      ...config.transport,
      failure_probability: config.transport.failure_probability ?? at('transport.failure_probability'),
      loss_fraction: config.transport.loss_fraction ?? at('transport.loss_fraction'),
    },
  }
}

/**
 * `config_preview.json` is `POST /config/preview` (backend `config_preview()`) for named host configs: `hidden`
 * (a new room, the risks blank), `typed` (the risks typed in with the backend's values) and variants of `typed`
 * (see the generator in the build log). Tests render what the server sent; they never compute a figure.
 */
export const CONFIG_PREVIEWS = fixture<Record<string, { config: GameConfig; preview: ConfigPreview }>>('config_preview.json')

/** The panel's preview state for a named server answer. */
export function previewState(name: string, over: Partial<ConfigPreviewState> = {}): ConfigPreviewState {
  const preview = CONFIG_PREVIEWS[name].preview
  return { preview, latest: preview, pending: false, ...over }
}
