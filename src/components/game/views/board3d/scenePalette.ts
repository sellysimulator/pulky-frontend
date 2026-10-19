import type { RiskStateId, SignColour } from './sceneModel'

/** Canvases cannot read CSS variables, so the scene's hexes are literals (design.md §14.1). */
export const SCENE_HEX = {
  sky: '#6EC6DD',
  hemisphereSky: '#FFFDF8',
  hemisphereGround: '#F2EDE1',
  ground: '#D8C9A3',
  yard: '#E4D6B8',
  road: '#B9A98A',
  floorTile: '#EFE8D7',
  tileLine: '#C9BEA6',
  walls: '#F5F0E3',
  wallBand: '#C9BEA6',
  woodDark: '#6B4A2F',
  woodLight: '#A8835A',
  vat: '#9C7550',
  pulque: '#F4F1E6',
  cover: '#DEEBF3',
  boardFace: '#2F3B35',
  bin: '#8C8069',
  agave: '#6F9A86',
  contact: '#000000',
  plate: '#FFFDF8',
  ink: '#26221B',
  danger: '#8F2E16',
  chalk: '#FFFDF8',
  chalkWarning: '#E3C98F',
  riskSafe: '#2D6A55',
  riskAtRisk: '#A06A12',
  riskLikely: '#B23A1E',
} as const

export type SceneHexKey = keyof typeof SCENE_HEX

/** The keys that mirror a design token, and the token each mirrors. */
export const TOKEN_MIRRORS: Partial<Record<SceneHexKey, string>> = {
  hemisphereSky: 'card',
  floorTile: 'muted',
  tileLine: 'border-strong',
  walls: 'canvas',
  wallBand: 'border-strong',
  cover: 'info-subtle',
  bin: 'border-control',
  plate: 'card',
  ink: 'ink',
  danger: 'danger-ink',
  chalk: 'on-ink',
  chalkWarning: 'warning-line',
  riskSafe: 'success',
  riskAtRisk: 'warning',
  riskLikely: 'danger',
}

export const SIGN_HEX: Record<SignColour, string> = {
  ink: SCENE_HEX.ink,
  danger: SCENE_HEX.danger,
  chalk: SCENE_HEX.chalk,
  chalkWarning: SCENE_HEX.chalkWarning,
}

export const RISK_HEX: Record<RiskStateId, string> = {
  safe: SCENE_HEX.riskSafe,
  at_risk: SCENE_HEX.riskAtRisk,
  likely: SCENE_HEX.riskLikely,
}
