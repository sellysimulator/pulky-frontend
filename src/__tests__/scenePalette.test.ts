import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  RISK_HEX,
  SCENE_HEX,
  SIGN_HEX,
  TOKEN_MIRRORS,
} from '../components/game/views/board3d/scenePalette'

// design.md §14.1, written out literally.
const DESIGN_TABLE = {
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

// design.md §14.1, "Token" column.
const DESIGN_TOKENS = {
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
} as const

const CSS = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

function tokenValue(token: string): string | null {
  const match = new RegExp(`--color-${token}\\s*:\\s*(#[0-9a-fA-F]{6})\\b`).exec(CSS)
  return match ? match[1].toLowerCase() : null
}

describe('SCENE_HEX', () => {
  it('equals design.md §14.1 key for key', () => {
    expect(SCENE_HEX).toEqual(DESIGN_TABLE)
  })

  it('every value is an uppercase #RRGGBB literal', () => {
    for (const [key, value] of Object.entries(SCENE_HEX)) {
      expect(value, key).toMatch(/^#[0-9A-F]{6}$/)
    }
  })
})

describe('TOKEN_MIRRORS', () => {
  it('names exactly the keys design.md §14.1 gives a token, and that token', () => {
    expect(TOKEN_MIRRORS).toEqual(DESIGN_TOKENS)
  })

  it('every mirrored key equals its token in src/index.css (case-insensitive)', () => {
    const drift: string[] = []
    for (const [key, token] of Object.entries(TOKEN_MIRRORS)) {
      const css = tokenValue(token as string)
      const hex = SCENE_HEX[key as keyof typeof SCENE_HEX]
      if (css === null) drift.push(`${key}: --color-${token} not found in index.css`)
      else if (hex.toLowerCase() !== css) drift.push(`${key}: ${hex} != --color-${token} ${css}`)
    }
    expect(drift).toEqual([])
  })

  it('the token parser can see a drifted value (the check is not vacuous)', () => {
    // riskAtRisk mirrors --color-warning; the CSS value is what the check compares against.
    expect(tokenValue('warning')).toBe('#a06a12')
    expect(tokenValue('warning')).not.toBe('#b23a1e')
    expect(Object.keys(TOKEN_MIRRORS)).toContain('riskAtRisk')
  })
})

describe('SIGN_HEX and RISK_HEX', () => {
  it('sign colours come from the scene palette', () => {
    expect(SIGN_HEX).toEqual({
      ink: SCENE_HEX.ink,
      danger: SCENE_HEX.danger,
      chalk: SCENE_HEX.chalk,
      chalkWarning: SCENE_HEX.chalkWarning,
    })
  })

  it('risk states map to the hoop colours', () => {
    expect(RISK_HEX).toEqual({
      safe: SCENE_HEX.riskSafe,
      at_risk: SCENE_HEX.riskAtRisk,
      likely: SCENE_HEX.riskLikely,
    })
  })
})
