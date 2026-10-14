import { describe, expect, it } from 'vitest'
import { resultsPath } from '../utils/resultsPath'

describe('resultsPath (spec 13.8)', () => {
  it('points at the room code, upper-cased, while the game is not persisted', () => {
    expect(resultsPath('abc234', null)).toBe('/results/ABC234')
    expect(resultsPath('ABC234', null)).toBe('/results/ABC234')
  })

  it('points at the persisted game once its public id is known', () => {
    expect(resultsPath('ABC234', 'f00d')).toBe('/results/g/f00d')
  })

  it('prefers the game id over the room code, because a room code can be reused', () => {
    const path = resultsPath('abc234', '0123abcd')
    expect(path).toBe('/results/g/0123abcd')
    expect(path).not.toContain('ABC234')
    expect(path).not.toContain('abc234')
  })
})
