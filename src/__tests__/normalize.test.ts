/** Section 32 - model normalisation (plan 32 sections 2 and 4). Failure mode 14. */
import { Box3, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { MODEL_FIT, normalizeTransform } from '../components/game/views/board3d/normalize'

const box = (min: [number, number, number], max: [number, number, number]) =>
  new Box3(new Vector3(...min), new Vector3(...max))

function expectTransform(got: ReturnType<typeof normalizeTransform>, offset: [number, number, number], scale: number) {
  expect(got.offset.x).toBeCloseTo(offset[0], 6)
  expect(got.offset.y).toBeCloseTo(offset[1], 6)
  expect(got.offset.z).toBeCloseTo(offset[2], 6)
  expect(got.scale).toBeCloseTo(scale, 6)
}

describe('MODEL_FIT', () => {
  it('names the target axis and size of each model', () => {
    expect(MODEL_FIT).toEqual({
      truck: { axis: 'z', size: 5 },
      money: { axis: 'z', size: 0.5 },
      tree: { axis: 'y', size: 6 },
    })
  })
})

describe('normalizeTransform (failure mode 14)', () => {
  it('fits the z axis', () =>
    expectTransform(normalizeTransform(box([-2, -1, -3], [2, 3, 5]), { axis: 'z', size: 4 }), [0, -1, 1], 0.5))
  it('fits the y axis', () =>
    expectTransform(normalizeTransform(box([-2, -1, -3], [2, 3, 5]), { axis: 'y', size: 2 }), [0, -1, 1], 0.5))
  it('floors a zero-size axis so the scale stays finite', () => {
    const got = normalizeTransform(box([0, 0, 0], [1, 0, 1]), { axis: 'y', size: 2 })
    expectTransform(got, [0.5, 0, 0.5], 2000)
    expect(Number.isFinite(got.scale)).toBe(true)
  })
  it('centres on x and z but rests the lowest point at y', () =>
    expectTransform(normalizeTransform(box([10, 4, 20], [14, 6, 28]), { axis: 'z', size: 8 }), [12, 4, 24], 1))
})
