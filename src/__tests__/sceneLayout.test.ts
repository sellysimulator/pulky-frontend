import { describe, expect, it } from 'vitest'
import {
  AGAVES,
  AGAVE_REACH,
  BIN,
  BOARD,
  BOARD_SPOTS,
  BOARD_TEXT_HEIGHT,
  CASH_PER_STACK,
  CASH_STACK_CAP,
  CELLAR_TITLE_Y,
  COUNTER,
  COUNTER_TOP_Y,
  EMPTY_SIGN_Y,
  FIXED_DRAW_CALLS,
  FUTURES_ROWS,
  GATE_HALF_WIDTH,
  GLYPH_ADVANCE,
  HALL,
  INTERACT_DISTANCE,
  LAYER_Y,
  LINE_HEIGHT,
  MAX_DRAW_CALLS,
  MAX_SIGNS,
  MONEY,
  MOVEMENT_BOUNDS,
  PANEL_ORDER,
  PANEL_TITLES,
  PLATE_MARGIN,
  PLATE_OFFSET,
  SIGN_CLEARANCE,
  SIGN_GAP,
  SIGN_MAX_WIDTH,
  SIGN_SIZE,
  SPAWN,
  STACK_GAP,
  STAND_OFFS,
  STATION_PANEL,
  SURFACE_TEXT_OFFSET,
  TREES,
  TREE_REACH,
  TRUCK,
  TRUCK_SLOTS,
  VAT,
  VAT_FULL_UNITS,
  VAT_SLOTS,
  WALL_CLEARANCE,
  YARD_EDGE_Z,
  boardTextMaxWidth,
  centredRow,
  rowRun,
  textBlockSize,
} from '../components/game/views/board3d/sceneLayout'

describe('sceneLayout constants (plan 31 §2, every value exact)', () => {
  it('the hall and its openings', () => {
    expect(HALL).toEqual({
      width: 24,
      depth: 36,
      halfWidth: 12,
      halfDepth: 18,
      wallHeight: 4.5,
      wallThickness: 0.3,
      eyeHeight: 1.7,
    })
    expect(GATE_HALF_WIDTH).toBe(3)
    expect(YARD_EDGE_Z).toBe(-5)
    expect(LAYER_Y).toEqual({ ground: 0, floor: 0.01, road: 0.02, contact: 0.03 })
    expect(SURFACE_TEXT_OFFSET).toBe(0.02)
  })

  it('layers are distinct, strictly rising heights (no z-fighting)', () => {
    const ys = [LAYER_Y.ground, LAYER_Y.floor, LAYER_Y.road, LAYER_Y.contact]
    expect(new Set(ys).size).toBe(4)
    expect([...ys].sort((a, b) => a - b)).toEqual(ys)
    expect(SURFACE_TEXT_OFFSET).toBeGreaterThan(0)
  })

  it('movement bounds are 2.5 m inside every wall', () => {
    expect(MOVEMENT_BOUNDS).toEqual({ minX: -9.5, maxX: 9.5, minZ: -15.5, maxZ: 15.5 })
    expect(MOVEMENT_BOUNDS.maxX).toBeCloseTo(HALL.halfWidth - 2.5, 9)
    expect(MOVEMENT_BOUNDS.maxZ).toBeCloseTo(HALL.halfDepth - 2.5, 9)
  })

  it('spawn faces north from the south end', () => {
    expect(SPAWN.position).toEqual([0, 1.7, 14])
    expect(SPAWN.yaw).toBe(0)
    expect(SPAWN.pitch).toBe(-0.08)
    expect(SPAWN.position[1]).toBe(HALL.eyeHeight)
  })

  it('stations, panels and titles', () => {
    expect(INTERACT_DISTANCE).toBe(3)
    expect(STAND_OFFS).toEqual({
      decision: [0, 0, 10.5],
      'day-stats': [-9.5, 0, 4],
      market: [9.5, 0, 4],
      cellar: [0, 0, 3],
    })
    expect(STATION_PANEL).toEqual({
      decision: 'decision',
      'day-stats': 'day-stats',
      market: 'market',
      cellar: 'cellar',
    })
    expect(PANEL_ORDER).toEqual(['day-stats', 'yesterday', 'decision', 'cellar', 'market', 'details'])
    expect(PANEL_TITLES).toEqual({
      'day-stats': 'Day stats',
      yesterday: 'Yesterday',
      decision: "Today's decision",
      cellar: 'Your cellar',
      market: 'Market',
      details: 'Details',
    })
  })

  it('counter and money', () => {
    expect(COUNTER).toEqual({
      x: 0,
      z: 8,
      width: 6,
      bodyHeight: 1,
      depth: 0.9,
      topWidth: 6.2,
      topDepth: 1,
      topThickness: 0.1,
      textTop: 0.92,
      textMaxWidth: 5.6,
    })
    expect(COUNTER_TOP_Y).toBeCloseTo(COUNTER.bodyHeight + COUNTER.topThickness, 9)
    expect(COUNTER_TOP_Y).toBeCloseTo(1.1, 9)
    expect(COUNTER.z + COUNTER.depth / 2).toBeCloseTo(8.45, 9)
    expect(MONEY).toEqual({
      columns: 4,
      rows: 2,
      tiers: 2,
      pitchX: 0.6,
      pitchZ: 0.3,
      pitchY: 0.16,
      centreX: 1.8,
      rotationY: Math.PI / 2,
    })
    expect(CASH_PER_STACK).toBe(1000)
    expect(CASH_STACK_CAP).toBe(16)
    expect(CASH_STACK_CAP).toBe(MONEY.columns * MONEY.rows * MONEY.tiers)
  })

  it('boards', () => {
    expect(BOARD).toEqual({ height: 3, centreY: 2.45, frame: 0.12, frameDepth: 0.08, faceDepth: 0.02, padding: 0.15 })
    expect(BOARD_SPOTS).toEqual({
      'day-stats': { x: -12, z: 4, rotationY: Math.PI / 2, width: 5 },
      market: { x: 12, z: 4, rotationY: -Math.PI / 2, width: 5 },
      supplier: { x: -7.5, z: -18, rotationY: 0, width: 6 },
      futures: { x: 7.5, z: -18, rotationY: 0, width: 6 },
    })
    expect(BOARD_TEXT_HEIGHT).toBeCloseTo(2.46, 9)
    expect(BOARD_TEXT_HEIGHT).toBeCloseTo(BOARD.height - 2 * BOARD.frame - 2 * BOARD.padding, 9)
  })

  it('boardTextMaxWidth', () => {
    expect(boardTextMaxWidth(5)).toBeCloseTo(4.46, 9)
    expect(boardTextMaxWidth(6)).toBeCloseTo(5.46, 9)
  })

  it('vats, bin, trucks, rows', () => {
    expect(VAT).toEqual({ radius: 0.7, height: 1, floorY: 0.12, liquidTopY: 0.92, z: 0, pitch: 3 })
    expect(VAT_SLOTS).toBe(6)
    expect(VAT_FULL_UNITS).toBe(60)
    expect(CELLAR_TITLE_Y).toBe(3.85)
    expect(EMPTY_SIGN_Y).toBe(1.6)
    expect(BIN).toEqual({ x: -10.2, z: -3, radiusTop: 0.45, radiusBottom: 0.4, height: 0.9 })
    expect(TRUCK).toEqual({ z: -9.5, pitch: 4, length: 5, width: 1.46, height: 1.91, rotationY: 0 })
    expect(TRUCK_SLOTS).toBe(4)
    expect(FUTURES_ROWS).toBe(5)
  })

  it('signs, clearances and budgets', () => {
    expect(SIGN_SIZE).toEqual({
      title: 0.42,
      row: 0.26,
      empty: 0.3,
      boardTitle: 0.36,
      boardRow: 0.26,
      counterTitle: 0.34,
      counterRow: 0.22,
    })
    expect(SIGN_MAX_WIDTH).toEqual({ vat: 2.6, truck: 3.4, bin: 2.7, title: 4, empty: 7 })
    expect(GLYPH_ADVANCE).toBe(0.58)
    expect(LINE_HEIGHT).toBe(1.5)
    expect(PLATE_MARGIN).toBe(0.25)
    expect(PLATE_OFFSET).toBe(0.02)
    expect(STACK_GAP).toBe(0.12)
    expect(SIGN_CLEARANCE).toBe(0.4)
    expect(SIGN_GAP).toBe(0.2)
    expect(WALL_CLEARANCE).toBe(0.3)
    expect(FIXED_DRAW_CALLS).toBe(21)
    expect(MAX_SIGNS).toBe(30)
    expect(MAX_DRAW_CALLS).toBe(60)
    expect(AGAVE_REACH).toBe(0.93)
    expect(TREE_REACH).toBe(2.5)
  })

  it('trees', () => {
    expect(TREES).toEqual([
      { x: -15.5, z: -8, rotationY: 0 },
      { x: 15.5, z: 2, rotationY: 1.9 },
      { x: -15.5, z: 13, rotationY: 4.1 },
    ])
  })

  it('agaves: four in the yard, then sixteen in the fields, z outer, x inner', () => {
    const points: [number, number][] = [
      [-10.5, -13],
      [10.5, -13],
      [-10.5, -7],
      [10.5, -7],
    ]
    for (const z of [-23, -27, -31, -35]) for (const x of [-7, -4.5, 4.5, 7]) points.push([x, z])
    expect(AGAVES).toHaveLength(20)
    points.forEach(([x, z], i) => {
      expect(AGAVES[i].x).toBe(x)
      expect(AGAVES[i].z).toBe(z)
      expect(AGAVES[i].rotationY).toBeCloseTo(i * 0.7, 9)
      expect(AGAVES[i].scale).toBe([1, 0.9, 1.1, 1.2][i % 4])
    })
  })
})

describe('centredRow', () => {
  it('worked examples', () => {
    expect(centredRow(0, 1, 3)).toBeCloseTo(0, 9)
    expect(centredRow(0, 6, 3)).toBeCloseTo(-7.5, 9)
    expect(centredRow(5, 6, 3)).toBeCloseTo(7.5, 9)
    expect(centredRow(1, 2, 4)).toBeCloseTo(2, 9)
  })

  it('is (index - (count - 1) / 2) x pitch', () => {
    for (const count of [1, 2, 3, 4, 5, 6]) {
      for (let i = 0; i < count; i += 1) {
        expect(centredRow(i, count, 2.5)).toBeCloseTo((i - (count - 1) / 2) * 2.5, 9)
      }
    }
  })
})

describe('rowRun and textBlockSize', () => {
  it('rowRun is length x GLYPH_ADVANCE x size', () => {
    expect(rowRun('', 0.26)).toBeCloseTo(0, 9)
    expect(rowRun('Lot #3', 0.26)).toBeCloseTo(6 * 0.58 * 0.26, 9)
    expect(rowRun('Risk tonight 100%', 0.26)).toBeCloseTo(17 * 0.58 * 0.26, 9)
  })

  it('worked examples', () => {
    const [w, h] = textBlockSize(['Your cellar'], 0.42, true)
    expect(w).toBeCloseTo(2.8896, 6)
    expect(h).toBeCloseTo(0.63, 6)
    const [mw, mh] = textBlockSize(['Day stats'], 0.36, false)
    expect(mw).toBeCloseTo(1.8792, 6)
    expect(mh).toBeCloseTo(0.36, 6)
  })

  it('width is the longest run, height adds line heights, a plate adds 2 x margin x size to both', () => {
    const rows = ['ab', 'abcdef', 'abc']
    const [w, h] = textBlockSize(rows, 0.3, false)
    expect(w).toBeCloseTo(6 * 0.58 * 0.3, 9)
    expect(h).toBeCloseTo(0.3 + 2 * 0.3 * 1.5, 9)
    const [fw, fh] = textBlockSize(rows, 0.3, true)
    expect(fw).toBeCloseTo(w + 2 * 0.25 * 0.3, 9)
    expect(fh).toBeCloseTo(h + 2 * 0.25 * 0.3, 9)
  })
})
