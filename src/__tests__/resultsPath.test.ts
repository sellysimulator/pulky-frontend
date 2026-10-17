import { describe, expect, it } from 'vitest'
import { resultsPath } from '../utils/resultsPath'

describe('resultsPath (spec 13.8)', () => {
  it('points at the game by its id', () => {
    expect(resultsPath('f00d')).toBe('/results/f00d')
  })

  it('never carries a room code, because a room code is reissued once its room expires', () => {
    const path = resultsPath('0123abcd')
    expect(path).toBe('/results/0123abcd')
    expect(path).not.toMatch(/[A-Z]{3}/)
  })
})
