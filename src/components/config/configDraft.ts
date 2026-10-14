/**
 * Pure helpers for the host config panel's draft: dot-path reads and writes,
 * the changed-leaves patch and the list of leaf paths. No React, no store.
 */
import type { GameConfig } from '../../types/game'

export type SectionId = 'game' | 'demand' | 'reputation' | 'supplier' | 'stock' | 'peer' | 'transport'

/** Spec §9.1 table order, per section. `random_seed` has no control. Insurance keys live in the calculator. */
export const SECTION_PATHS: Record<SectionId, string[]> = {
  game: ['max_players', 'duration_days', 'starting_cash'],
  demand: [
    'demand.per_player_peak',
    'demand.weekday_peak.from',
    'demand.weekday_peak.to',
    'demand.retail_price',
    'demand.backlog_penalty',
  ],
  reputation: ['reputation.starting', 'reputation.smoothing', 'reputation.waste_weight'],
  supplier: [
    'supplier.base_price',
    'supplier.spot_spread',
    'supplier.capacity_mean_per_player',
    'supplier.capacity_sd_per_player',
    'supplier.disruption_probability',
    'supplier.disruption_factor',
    'supplier.lead_time_days',
    'supplier.initial_pipeline_qty',
    'supplier.quality_min',
    'supplier.quality_max',
    'futures.horizon_days',
  ],
  stock: [
    'stock.fresh_days',
    'stock.max_days',
    'stock.holding_cost',
    'stock.initial_stock',
    'stock.salvage_value',
    'stock.conservation_extra_fresh_days',
    'stock.conservation_cost_per_unit',
  ],
  peer: ['peer_market.enabled'],
  transport: [
    'transport.unit_cost',
    'transport.shared',
    'transport.failure_probability',
    'transport.loss_fraction',
  ],
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function getAt(config: object, path: string): unknown {
  let node: unknown = config
  for (const key of path.split('.')) {
    if (!isPlainObject(node)) return undefined
    node = node[key]
  }
  return node
}

/** Returns a new object; `config` is never mutated. */
export function setAt<T extends object>(config: T, path: string, value: unknown): T {
  const keys = path.split('.')
  const write = (node: unknown, index: number): unknown => {
    const base = isPlainObject(node) ? node : {}
    const key = keys[index]
    return { ...base, [key]: index === keys.length - 1 ? value : write(base[key], index + 1) }
  }
  return write(config, 0) as T
}

function diff(base: unknown, draft: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(draft)) {
    const next = draft[key]
    const before = isPlainObject(base) ? base[key] : undefined
    if (isPlainObject(next)) {
      const nested = diff(before, next)
      if (Object.keys(nested).length > 0) out[key] = nested
    } else if (next !== before) {
      out[key] = next
    }
  }
  return out
}

/** The nested patch of changed leaves only; `{}` when nothing changed. */
export function diffPatch(base: GameConfig, draft: GameConfig): object {
  return diff(base, draft as unknown as Record<string, unknown>)
}

/** Dot paths of every leaf (a value that is not a plain object), alphabetical. */
export function leafPaths(config: object): string[] {
  const out: string[] = []
  const walk = (node: Record<string, unknown>, prefix: string): void => {
    for (const key of Object.keys(node)) {
      const path = prefix === '' ? key : `${prefix}.${key}`
      const value = node[key]
      if (isPlainObject(value)) walk(value, path)
      else out.push(path)
    }
  }
  walk(config as Record<string, unknown>, '')
  return out.sort()
}

/** The section a field path belongs to, or null when it matches none. */
export function sectionOf(path: string): SectionId | null {
  if (['max_players', 'duration_days', 'starting_cash'].includes(path)) return 'game'
  const head = path.split('.')[0]
  switch (head) {
    case 'demand':
      return 'demand'
    case 'reputation':
      return 'reputation'
    case 'supplier':
    case 'futures':
      return 'supplier'
    case 'stock':
      return 'stock'
    case 'peer_market':
      return 'peer'
    case 'transport':
    case 'insurance':
      return 'transport'
    default:
      return null
  }
}
