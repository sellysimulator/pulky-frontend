import { afterAll, describe, expect, it, vi } from 'vitest'
import {
  AGAVES,
  AGAVE_REACH,
  BIN,
  BOARD,
  BOARD_SPOTS,
  BOARD_TEXT_HEIGHT,
  CELLAR_TITLE_Y,
  COUNTER,
  EMPTY_SIGN_Y,
  FIXED_DRAW_CALLS,
  HALL,
  INTERACT_DISTANCE,
  LAYER_Y,
  MAX_DRAW_CALLS,
  MAX_SIGNS,
  MOVEMENT_BOUNDS,
  PANEL_TITLES,
  SIGN_GAP,
  SIGN_MAX_WIDTH,
  SIGN_SIZE,
  SPAWN,
  STACK_GAP,
  STAND_OFFS,
  STATION_PANEL,
  TREES,
  TREE_REACH,
  TRUCK,
  VAT,
  WALL_CLEARANCE,
  boardTextMaxWidth,
  centredRow,
  rowRun,
  textBlockSize,
} from '../components/game/views/board3d/sceneLayout'
import {
  buildSceneModel,
  cashStacks,
  estimateDrawCalls,
  stackDown,
  stackUp,
  vatLevel,
} from '../components/game/views/board3d/sceneModel'
import type { SceneModel, SceneSign } from '../components/game/views/board3d/sceneModel'
import {
  INCOTERM_TIER_NAMES,
  RISK_LABELS,
  formatMoney,
  formatPercent,
  formatQty,
  formatUnits,
  lotLabel,
  weekdayLong,
} from '../utils/format'
import {
  DISRUPTION_MESSAGE,
  RIVAL_NAME,
  baseProps,
  briefOf,
  cellarLot,
  contract,
  dayResults,
  deepFreeze,
  manyContracts,
  maximalProps,
  mixedCellar,
  mixedShipments,
  shipment,
  sweepVariants,
  variant,
} from './fixtures/sceneProps'

const TIMES = '×'
const DOT = '·'

function sign(model: SceneModel, id: string): SceneSign {
  const found = model.signs.find((s) => s.id === id)
  if (!found) throw new Error(`no sign "${id}"; have ${model.signs.map((s) => s.id).join(', ')}`)
  return found
}
const ids = (model: SceneModel): string[] => model.signs.map((s) => s.id)
const has = (model: SceneModel, id: string): boolean => model.signs.some((s) => s.id === id)
const rowsOf = (model: SceneModel, id: string): readonly string[] => sign(model, id).rows

function expectVec(actual: readonly number[], expected: readonly number[]): void {
  expect(actual).toHaveLength(3)
  expected.forEach((v, i) => expect(actual[i]).toBeCloseTo(v, 6))
}

function clone(model: SceneModel): SceneModel {
  return structuredClone(model)
}

const F = (): SceneModel => buildSceneModel(baseProps())

// ---------------------------------------------------------------------------------------------------------------------
// Acceptance 1: the modules import no three.js, @react-three/* or React.
// ---------------------------------------------------------------------------------------------------------------------
describe('module purity of imports (acceptance 1)', () => {
  const FORBIDDEN = ['react', 'react/jsx-runtime', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei']
  afterAll(() => {
    for (const name of FORBIDDEN) vi.doUnmock(name)
    vi.resetModules()
  })

  it('sceneLayout, scenePalette and sceneModel load with react, three and @react-three/* unavailable', async () => {
    vi.resetModules()
    for (const name of FORBIDDEN) {
      vi.doMock(name, () => {
        throw new Error(`forbidden import: ${name}`)
      })
    }
    await expect(import('../components/game/views/board3d/sceneLayout')).resolves.toBeTruthy()
    await expect(import('../components/game/views/board3d/scenePalette')).resolves.toBeTruthy()
    await expect(import('../components/game/views/board3d/sceneModel')).resolves.toBeTruthy()
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// Small functions
// ---------------------------------------------------------------------------------------------------------------------
describe('vatLevel and cashStacks (worked examples)', () => {
  it('vatLevel', () => {
    expect(vatLevel(0)).toBeCloseTo(0, 9)
    expect(vatLevel(30)).toBeCloseTo(0.5, 9)
    expect(vatLevel(60)).toBeCloseTo(1, 9)
    expect(vatLevel(75)).toBeCloseTo(1, 9)
    expect(vatLevel(99999)).toBeCloseTo(1, 9)
    expect(vatLevel(-4)).toBeCloseTo(0, 9)
    expect(vatLevel(12)).toBeCloseTo(0.2, 9)
  })

  it('cashStacks', () => {
    expect(cashStacks(-5)).toBe(0)
    expect(cashStacks(0)).toBe(0)
    expect(cashStacks(999.99)).toBe(0)
    expect(cashStacks(1000)).toBe(1)
    expect(cashStacks(1999.99)).toBe(1)
    expect(cashStacks(6120)).toBe(6)
    expect(cashStacks(15999.99)).toBe(15)
    expect(cashStacks(16000)).toBe(16)
    expect(cashStacks(99999)).toBe(16)
    expect(cashStacks(9999999.99)).toBe(16)
  })
})

function plain(id: string, y: number, height: number, extra: Partial<SceneSign> = {}): SceneSign {
  return {
    id,
    rows: ['x'],
    text: 'x',
    size: 0.26,
    colour: 'ink',
    position: [1.5, y, -2.5],
    rotationY: 0,
    floating: true,
    maxWidth: 2.6,
    width: 1,
    height,
    ...extra,
  }
}

describe('stackUp and stackDown (§3.2)', () => {
  it('stackUp: the last sign sits on baseY, each sign above is STACK_GAP higher; only y changes', () => {
    const a = plain('a', 0, 0.5, { position: [1, 9, 2] })
    const b = plain('b', 0, 0.3, { position: [3, 9, 4] })
    const [ra, rb] = stackUp(1, [a, b])
    expect(rb.position[1]).toBeCloseTo(1 + 0.15, 9)
    expect(ra.position[1]).toBeCloseTo(1 + 0.3 + STACK_GAP + 0.25, 9)
    expect([ra.position[0], ra.position[2]]).toEqual([1, 2])
    expect([rb.position[0], rb.position[2]]).toEqual([3, 4])
    expect(ra.id).toBe('a')
    expect(rb.id).toBe('b')
    expect(ra.height).toBe(0.5)
    expect(rb.rows).toEqual(['x'])
  })

  it('stackUp with one sign, three signs and none', () => {
    expect(stackUp(2, [plain('a', 0, 0.6)])[0].position[1]).toBeCloseTo(2.3, 9)
    expect(stackUp(2, [])).toEqual([])
    const [t, m, b] = stackUp(0, [plain('t', 0, 1), plain('m', 0, 1), plain('b', 0, 1)])
    expect(b.position[1]).toBeCloseTo(0.5, 9)
    expect(m.position[1]).toBeCloseTo(0.5 + 1 + STACK_GAP, 9)
    expect(t.position[1]).toBeCloseTo(0.5 + 2 * (1 + STACK_GAP), 9)
  })

  it('stackDown: the first sign hangs from topY, each next sign is STACK_GAP lower; only y changes', () => {
    const a = plain('a', 0, 0.5, { position: [1, 9, 2] })
    const b = plain('b', 0, 0.3, { position: [3, 9, 4] })
    const [ra, rb] = stackDown(4, [a, b])
    expect(ra.position[1]).toBeCloseTo(4 - 0.25, 9)
    expect(rb.position[1]).toBeCloseTo(4 - 0.5 - STACK_GAP - 0.15, 9)
    expect([ra.position[0], ra.position[2]]).toEqual([1, 2])
    expect([rb.position[0], rb.position[2]]).toEqual([3, 4])
    expect(stackDown(4, [])).toEqual([])
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// The worked examples of §4 (acceptance 2)
// ---------------------------------------------------------------------------------------------------------------------
describe('buildSceneModel: worked example F (§4)', () => {
  const m = F()

  it('vats', () => {
    expect(m.vats.map((v) => [v.lotId, v.level, v.risk, v.conserved])).toEqual([
      ['L3', expect.closeTo(0.2, 6), 'likely', false],
      ['L4', expect.closeTo(0.5, 6), 'likely', false],
      ['L5', expect.closeTo(0.75, 6), 'at_risk', true],
    ])
    expectVec(m.vats[0].position, [-3, 0, 0])
    expectVec(m.vats[1].position, [0, 0, 0])
    expectVec(m.vats[2].position, [3, 0, 0])
  })

  it('vat signs: rows, size, position', () => {
    expect(rowsOf(m, 'vat-L3')).toEqual(['Lot #3', '12 units', 'Risk tonight 100%', 'Likely to spoil'])
    expect(rowsOf(m, 'vat-L4')).toEqual(['Lot #4', '30 units', 'Risk tonight 77%', 'Likely to spoil'])
    expect(rowsOf(m, 'vat-L5')).toEqual(['Lot #5', '45 units', 'Risk tonight 10%', 'At risk', 'Conserved'])
    const l3 = sign(m, 'vat-L3')
    expect(l3.width).toBeCloseTo(2.6936, 6)
    expect(l3.height).toBeCloseTo(1.56, 6)
    expectVec(l3.position, [-3, 2.18, 0])
    const l5 = sign(m, 'vat-L5')
    expect(l5.height).toBeCloseTo(1.95, 6)
    expectVec(l5.position, [3, 2.375, 0])
  })

  it('cellar title', () => {
    const t = sign(m, 'cellar-title')
    expect(t.rows).toEqual(['Your cellar'])
    expect(t.width).toBeCloseTo(2.8896, 6)
    expect(t.height).toBeCloseTo(0.63, 6)
    expectVec(t.position, [0, 3.85, 0])
    expect(t.size).toBe(0.42)
    expect(t.colour).toBe('ink')
    expect(t.maxWidth).toBe(4)
    expect(t.floating).toBe(true)
  })

  it('trucks and their signs', () => {
    expect(m.trucks).toHaveLength(1)
    expect(m.trucks[0].shippedDay).toBe(4)
    expect(m.trucks[0].arrivesDay).toBe(5)
    expectVec(m.trucks[0].position, [0, 0, -9.5])
    expect(m.trucks[0].rotationY).toBeCloseTo(0, 9)
    const main = sign(m, 'truck-4')
    expect(main.rows).toEqual(['Arrives today', '40 units · CIP'])
    expect(main.height).toBeCloseTo(0.78, 6)
    expectVec(main.position, [0, 3.21, -9.5])
    expect(main.position[1] - main.height / 2).toBeCloseTo(2.82, 6)
    const lost = sign(m, 'truck-4-lost')
    expect(lost.rows).toEqual(['15 lost in transit'])
    expect(lost.colour).toBe('danger')
    expect(lost.height).toBeCloseTo(0.39, 6)
    expectVec(lost.position, [0, 2.505, -9.5])
  })

  it('counter, boards, bin', () => {
    expect(rowsOf(m, 'counter-status')).toEqual(['Cash $6,120.00 · Backlog 3 units'])
    expect(rowsOf(m, 'board-day-stats-body')).toEqual([
      'Day 5/14 · Friday',
      `Weekday ${TIMES}1.00`,
      'Your demand ~27',
      'Spot price $13.40',
      'Reputation 0.62',
    ])
    expect(rowsOf(m, 'board-market-body')).toEqual([
      'Sold yesterday: 24 units',
      'Your share: 26%',
      'Market sold: 92 units',
      'Peer market: 18 units',
      'at $14.11 on average',
    ])
    expect(rowsOf(m, 'board-supplier-body')).toEqual([
      'Spot price $13.40/unit',
      'Base price $12.00/unit',
      'Spot order arrives day 6',
    ])
    expect(rowsOf(m, 'board-futures-body')).toEqual(['Day 12: 25 units'])
    expect(rowsOf(m, 'bin')).toEqual(['Spoiled overnight', '6 units', 'Salvaged for', '$12.00'])
  })

  it('money stacks', () => {
    expect(m.money).toHaveLength(6)
    const expected = [
      [0.9, 1.1, 7.85],
      [1.5, 1.1, 7.85],
      [2.1, 1.1, 7.85],
      [2.7, 1.1, 7.85],
      [0.9, 1.1, 8.15],
      [1.5, 1.1, 8.15],
    ]
    expected.forEach((e, i) => expectVec(m.money[i], e))
  })

  it('counts, budget and description', () => {
    expect(m.signs).toHaveLength(17)
    expect(estimateDrawCalls(m)).toBe(38)
    expect(m.description).toBe(
      'Your pulquería in 3D: 3 lots in the cellar, 1 shipment on the road, 1 open futures contract. Every number is also in the panels.',
    )
    expect(m.hidden).toEqual({ lots: 0, shipments: 0, contracts: 0 })
  })

  it('stations: always four, in order', () => {
    expect(m.stations.map((s) => s.id)).toEqual(['decision', 'day-stats', 'market', 'cellar'])
    for (const s of m.stations) {
      expect(s.panel).toBe(STATION_PANEL[s.id])
      expect(s.title).toBe(PANEL_TITLES[s.panel])
      expect(s.standOff).toEqual(STAND_OFFS[s.id])
    }
    expect(m.stations.map((s) => s.title)).toEqual(["Today's decision", 'Day stats', 'Market', 'Your cellar'])
  })

  it('contacts: counter, vats, bin, trucks, on the contact layer', () => {
    expect(m.contacts).toHaveLength(1 + 3 + 1 + 1)
    const [counter, v1, v2, v3, bin, truck] = m.contacts
    expectVec(counter.position, [COUNTER.x, LAYER_Y.contact, COUNTER.z])
    expect(counter.sizeX).toBeCloseTo(6.6, 6)
    expect(counter.sizeZ).toBeCloseTo(1.4, 6)
    ;[v1, v2, v3].forEach((c, i) => {
      expectVec(c.position, [[-3, 0, 3][i], LAYER_Y.contact, 0])
      expect(c.sizeX).toBeCloseTo(1.7, 6)
      expect(c.sizeZ).toBeCloseTo(1.7, 6)
    })
    expectVec(bin.position, [BIN.x, LAYER_Y.contact, BIN.z])
    expect(bin.sizeX).toBeCloseTo(1.2, 6)
    expect(bin.sizeZ).toBeCloseTo(1.2, 6)
    expectVec(truck.position, [0, LAYER_Y.contact, TRUCK.z])
    expect(truck.sizeX).toBeCloseTo(1.86, 6)
    expect(truck.sizeZ).toBeCloseTo(5.4, 6)
  })

  it('sign ids and order', () => {
    expect(ids(m)).toEqual([
      'counter-title',
      'counter-status',
      'board-day-stats-title',
      'board-day-stats-body',
      'board-market-title',
      'board-market-body',
      'board-supplier-title',
      'board-supplier-body',
      'board-futures-title',
      'board-futures-body',
      'cellar-title',
      'vat-L3',
      'vat-L4',
      'vat-L5',
      'bin',
      'truck-4',
      'truck-4-lost',
    ])
  })

  it('titles and mounted placement', () => {
    expect(rowsOf(m, 'counter-title')).toEqual(["Today's decision"])
    expect(rowsOf(m, 'board-day-stats-title')).toEqual(['Day stats'])
    expect(rowsOf(m, 'board-market-title')).toEqual(['Market'])
    expect(rowsOf(m, 'board-supplier-title')).toEqual(['Supplier'])
    expect(rowsOf(m, 'board-futures-title')).toEqual(['Futures book'])

    const ct = sign(m, 'counter-title')
    const cs = sign(m, 'counter-status')
    for (const s of [ct, cs]) {
      expect(s.floating).toBe(false)
      expect(s.colour).toBe('chalk')
      expect(s.rotationY).toBeCloseTo(0, 9)
      expect(s.maxWidth).toBe(5.6)
      expect(s.position[0]).toBeCloseTo(0, 9)
      expect(s.position[2]).toBeCloseTo(8.47, 6)
    }
    expect(ct.size).toBe(0.34)
    expect(cs.size).toBe(0.22)
    expect(ct.position[1] + ct.height / 2).toBeCloseTo(0.92, 6)
    expect(cs.position[1] + cs.height / 2).toBeCloseTo(ct.position[1] - ct.height / 2 - STACK_GAP, 6)

    const stands: Record<string, { n: [number, number] }> = {
      'day-stats': { n: [1, 0] },
      market: { n: [-1, 0] },
      supplier: { n: [0, 1] },
      futures: { n: [0, 1] },
    }
    for (const b of ['day-stats', 'market', 'supplier', 'futures'] as const) {
      const spot = BOARD_SPOTS[b]
      const title = sign(m, `board-${b}-title`)
      const body = sign(m, `board-${b}-body`)
      for (const s of [title, body]) {
        expect(s.floating).toBe(false)
        expect(s.colour).toBe('chalk')
        expect(s.rotationY).toBeCloseTo(spot.rotationY, 9)
        expect(s.maxWidth).toBeCloseTo(boardTextMaxWidth(spot.width), 9)
        expect(s.position[0]).toBeCloseTo(spot.x + stands[b].n[0] * 0.12, 6)
        expect(s.position[2]).toBeCloseTo(spot.z + stands[b].n[1] * 0.12, 6)
      }
      expect(title.size).toBe(0.36)
      expect(body.size).toBe(0.26)
      expect(title.position[1] + title.height / 2).toBeCloseTo(BOARD.centreY + BOARD_TEXT_HEIGHT / 2, 6)
      expect(body.position[1] + body.height / 2).toBeCloseTo(title.position[1] - title.height / 2 - STACK_GAP, 6)
    }
  })

  it('floating signs: rotationY 0, floating, sized and limited per kind', () => {
    for (const id of ['vat-L3', 'vat-L4', 'vat-L5']) {
      const s = sign(m, id)
      expect(s.floating).toBe(true)
      expect(s.rotationY).toBe(0)
      expect(s.size).toBe(SIGN_SIZE.row)
      expect(s.colour).toBe('ink')
      expect(s.maxWidth).toBe(SIGN_MAX_WIDTH.vat)
    }
    for (const id of ['truck-4', 'truck-4-lost']) {
      expect(sign(m, id).maxWidth).toBe(SIGN_MAX_WIDTH.truck)
      expect(sign(m, id).floating).toBe(true)
    }
    expect(sign(m, 'bin').maxWidth).toBe(SIGN_MAX_WIDTH.bin)
    expect(sign(m, 'bin').position[0]).toBeCloseTo(BIN.x, 9)
    expect(sign(m, 'bin').position[2]).toBeCloseTo(BIN.z, 9)
    expect(sign(m, 'bin').position[1] - sign(m, 'bin').height / 2).toBeCloseTo(BIN.height + 0.4, 6)
  })
})

describe('buildSceneModel: variants of F (§4)', () => {
  it('8 lots: five vats, an overflow sign in the last slot', () => {
    const m = buildSceneModel(variant((p) => void (p.view.cellar = mixedCellar(8))))
    expect(m.vats).toHaveLength(5)
    expect(m.vats.map((v) => v.position[0])).toEqual([-7.5, -4.5, -1.5, 1.5, 4.5])
    const o = sign(m, 'cellar-overflow')
    expect(o.rows).toEqual(['+3 more lots', 'See Your cellar'])
    expect(o.position[0]).toBeCloseTo(7.5, 6)
    expect(o.position[2]).toBeCloseTo(0, 6)
    expect(o.position[1] - o.height / 2).toBeCloseTo(1.4, 6)
    expect(o.maxWidth).toBe(SIGN_MAX_WIDTH.vat)
    expect(m.hidden.lots).toBe(3)
    expect(has(m, 'cellar-empty')).toBe(false)
  })

  it('6 lots fill the six slots with no overflow', () => {
    const m = buildSceneModel(variant((p) => void (p.view.cellar = mixedCellar(6))))
    expect(m.vats.map((v) => v.position[0])).toEqual([-7.5, -4.5, -1.5, 1.5, 4.5, 7.5])
    expect(has(m, 'cellar-overflow')).toBe(false)
    expect(m.hidden.lots).toBe(0)
  })

  it('2 lots are centred at pitch 3', () => {
    const m = buildSceneModel(variant((p) => void (p.view.cellar = mixedCellar(2))))
    expect(m.vats.map((v) => v.position[0])).toEqual([-1.5, 1.5])
  })

  it('6 shipments: three trucks and an overflow sign in the last slot', () => {
    const m = buildSceneModel(variant((p) => void (p.view.in_transit = mixedShipments(6, false))))
    expect(m.trucks).toHaveLength(3)
    expect(m.trucks.map((t) => t.position[0])).toEqual([-6, -2, 2])
    const o = sign(m, 'yard-overflow')
    expect(o.rows).toEqual(['+3 more shipments', 'See Your cellar'])
    expect(o.position[0]).toBeCloseTo(6, 6)
    expect(o.position[2]).toBeCloseTo(TRUCK.z, 6)
    expect(o.position[1] - o.height / 2).toBeCloseTo(TRUCK.height + 0.4, 6)
    expect(o.maxWidth).toBe(SIGN_MAX_WIDTH.truck)
    expect(m.hidden.shipments).toBe(3)
  })

  it('4 shipments fill the four slots; 2 are centred at pitch 4', () => {
    const four = buildSceneModel(variant((p) => void (p.view.in_transit = mixedShipments(4, false))))
    expect(four.trucks.map((t) => t.position[0])).toEqual([-6, -2, 2, 6])
    expect(has(four, 'yard-overflow')).toBe(false)
    const two = buildSceneModel(variant((p) => void (p.view.in_transit = mixedShipments(2, false))))
    expect(two.trucks.map((t) => t.position[0])).toEqual([-2, 2])
  })

  it('7 contracts: four rows then a "more" row; hidden.contracts 3', () => {
    const m = buildSceneModel(variant((p) => void (p.view.futures_book = manyContracts(7))))
    const rows = rowsOf(m, 'board-futures-body')
    expect(rows).toHaveLength(5)
    expect(rows[4]).toBe('+3 more contracts')
    expect(m.hidden.contracts).toBe(3)
  })

  it('exactly five contracts show five rows and hide none', () => {
    const m = buildSceneModel(variant((p) => void (p.view.futures_book = manyContracts(5))))
    expect(rowsOf(m, 'board-futures-body')).toHaveLength(5)
    expect(rowsOf(m, 'board-futures-body').some((r) => r.includes('more contracts'))).toBe(false)
    expect(m.hidden.contracts).toBe(0)
  })

  it('no contracts: the empty row', () => {
    const m = buildSceneModel(variant((p) => void (p.view.futures_book = [])))
    expect(rowsOf(m, 'board-futures-body')).toEqual(['No open futures.'])
  })

  it('empty cellar: no vats and the empty-cellar sign', () => {
    const m = buildSceneModel(variant((p) => void (p.view.cellar = [])))
    expect(m.vats).toEqual([])
    const e = sign(m, 'cellar-empty')
    expect(e.rows).toEqual(['The cellar is empty', 'Stock arrives with your next delivery.'])
    expect(e.size).toBe(0.3)
    expect(e.colour).toBe('ink')
    expect(e.maxWidth).toBe(7)
    expect(e.floating).toBe(true)
    expectVec(e.position, [0, 1.6, 0])
    expect(has(m, 'cellar-title')).toBe(true)
    expect(has(m, 'cellar-overflow')).toBe(false)
    expect(m.hidden.lots).toBe(0)
  })

  it('empty yard: no trucks and the empty-yard sign', () => {
    const m = buildSceneModel(variant((p) => void (p.view.in_transit = [])))
    expect(m.trucks).toEqual([])
    const e = sign(m, 'yard-empty')
    expect(e.rows).toEqual(['Nothing in transit.'])
    expect(e.maxWidth).toBe(7)
    expectVec(e.position, [0, 1.6, TRUCK.z])
    expect(m.contacts).toHaveLength(1 + 3 + 1)
  })

  it('empty publicHistory: the no-results row', () => {
    const m = buildSceneModel(variant((p) => void (p.publicHistory = [])))
    expect(rowsOf(m, 'board-market-body')).toEqual(['No results yet'])
  })

  it('a last entry without the player: the no-results row', () => {
    const m = buildSceneModel(
      variant((p) => {
        p.publicHistory = [dayResults({ day: 4, unitsSoldTotal: 10, peerUnits: 0, peerAvgPrice: null, own: null })]
      }),
    )
    expect(rowsOf(m, 'board-market-body')).toEqual(['No results yet'])
  })

  it('the market board reads the LAST entry', () => {
    const m = buildSceneModel(
      variant((p) => {
        p.publicHistory = [
          dayResults({ day: 3, unitsSoldTotal: 50, peerUnits: 7, peerAvgPrice: 9, own: { units_sold: 5, market_share: 0.1 } }),
          ...p.publicHistory,
        ]
      }),
    )
    expect(rowsOf(m, 'board-market-body')[0]).toBe('Sold yesterday: 24 units')
  })

  it('peer market off: three rows and no Peer market row', () => {
    const m = buildSceneModel(variant((p) => void (p.config.peer_market.enabled = false)))
    const rows = rowsOf(m, 'board-market-body')
    expect(rows).toHaveLength(3)
    expect(rows.some((r) => r.startsWith('Peer market'))).toBe(false)
    expect(rows.some((r) => r.includes('on average'))).toBe(false)
  })

  it('peer market on with no trades: "Peer market: no trades" and no $0.00', () => {
    const m = buildSceneModel(
      variant((p) => {
        p.publicHistory = [
          dayResults({ day: 4, unitsSoldTotal: 92, peerUnits: 0, peerAvgPrice: null, own: { units_sold: 24, market_share: 0.26 } }),
        ]
      }),
    )
    const rows = rowsOf(m, 'board-market-body')
    expect(rows[rows.length - 1]).toBe('Peer market: no trades')
    expect(rows).toHaveLength(4)
    expect(rows.some((r) => r.includes('$0.00'))).toBe(false)
  })

  it('a disrupted supplier adds the warning sign in the warning colour', () => {
    const m = buildSceneModel(
      variant((p) => {
        briefOf(p).supplier.disrupted = true
        briefOf(p).supplier.disruption_message = DISRUPTION_MESSAGE
      }),
    )
    const w = sign(m, 'board-supplier-warning')
    expect(w.rows).toEqual(['Disrupted today'])
    expect(w.colour).toBe('chalkWarning')
    expect(w.size).toBe(0.26)
    expect(w.floating).toBe(false)
    const ordered = ids(m)
    expect(ordered.indexOf('board-supplier-warning')).toBe(ordered.indexOf('board-supplier-body') + 1)
  })

  it('day 1: yesterday null gives a bin of 0 units and no salvage rows', () => {
    const m = buildSceneModel(variant((p) => Object.assign(p.view, { yesterday: null })))
    expect(rowsOf(m, 'bin')).toEqual(['Spoiled overnight', '0 units'])
  })

  it('salvage rows are left out when revenue_salvage is 0, and 1 spoiled reads "1 unit"', () => {
    const m = buildSceneModel(variant((p) => Object.assign(p.view, { yesterday: { spoiled: 1, revenue_salvage: 0 } })))
    expect(rowsOf(m, 'bin')).toEqual(['Spoiled overnight', '1 unit'])
  })

  it('backlog 0 leaves out the backlog', () => {
    const m = buildSceneModel(variant((p) => void (p.view.backlog = 0)))
    expect(rowsOf(m, 'counter-status')).toEqual(['Cash $6,120.00'])
  })

  it('negative cash: the figure shows, no stacks', () => {
    const m = buildSceneModel(variant((p) => void (p.view.cash = -4.5)))
    expect(m.money).toEqual([])
    expect(rowsOf(m, 'counter-status')[0]).toBe(`Cash ${formatMoney(-4.5)} ${DOT} Backlog 3 units`)
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// §3.3 copy: the rest of the zones
// ---------------------------------------------------------------------------------------------------------------------
describe('copy and zones (§3.3)', () => {
  it('day stats rows: multiplier to 2 dp, demand rounded, brief rows left out when brief is null', () => {
    const m = buildSceneModel(
      variant((p) => {
        briefOf(p).weekday_multiplier = 0.75
        p.view.expected_demand_own = 27.6
        p.view.reputation = 0.5
      }),
    )
    expect(rowsOf(m, 'board-day-stats-body')).toEqual([
      'Day 5/14 · Friday',
      `Weekday ${TIMES}0.75`,
      'Your demand ~28',
      'Spot price $13.40',
      'Reputation 0.50',
    ])
    const n = buildSceneModel(variant((p) => Object.assign(p.view, { brief: null })))
    expect(rowsOf(n, 'board-day-stats-body')).toEqual(['Day 5/14 · Friday', 'Your demand ~27', 'Reputation 0.62'])
  })

  it('day 60 of 60 spells the weekday out', () => {
    const m = buildSceneModel(variant((p) => Object.assign(p.view, { day: 60, duration_days: 60, weekday: 'wed' })))
    expect(rowsOf(m, 'board-day-stats-body')[0]).toBe(`Day 60/60 ${DOT} ${weekdayLong('wed')}`)
  })

  it('supplier board: brief null gives a title only; shared transport and closed spot rows', () => {
    const none = buildSceneModel(variant((p) => Object.assign(p.view, { brief: null })))
    expect(has(none, 'board-supplier-title')).toBe(true)
    expect(has(none, 'board-supplier-body')).toBe(false)
    expect(has(none, 'board-supplier-warning')).toBe(false)

    const m = buildSceneModel(
      variant((p) => {
        briefOf(p).spot.open = false
        briefOf(p).transport.shared = true
      }),
    )
    expect(rowsOf(m, 'board-supplier-body')).toEqual([
      'Spot price $13.40/unit',
      'Base price $12.00/unit',
      'Spot orders closed',
      'Shared transport',
    ])
  })

  it('futures rows are "Day {delivery_day}: {units}" sorted by delivery day then contract day', () => {
    const m = buildSceneModel(
      variant((p) => {
        p.view.futures_book = [contract(3, 12, 30), contract(2, 9, 1), contract(1, 12, 20), contract(4, 10, 50)]
      }),
    )
    expect(rowsOf(m, 'board-futures-body')).toEqual([
      'Day 9: 1 unit',
      'Day 10: 50 units',
      'Day 12: 20 units',
      'Day 12: 30 units',
    ])
  })

  it('the market board percent and units use the shared formats', () => {
    const m = buildSceneModel(
      variant((p) => {
        p.publicHistory = [
          dayResults({ day: 4, unitsSoldTotal: 1234, peerUnits: 1, peerAvgPrice: 3.5, own: { units_sold: 1, market_share: 0.305 } }),
        ]
      }),
    )
    expect(rowsOf(m, 'board-market-body')).toEqual([
      'Sold yesterday: 1 unit',
      `Your share: ${formatPercent(0.305)}`,
      'Market sold: 1,234 units',
      'Peer market: 1 unit',
      'at $3.50 on average',
    ])
  })

  it('truck signs: tier names, day text, lost count uses the quantity format', () => {
    const m = buildSceneModel(
      variant((p) => {
        p.view.in_transit = [shipment(6, 8, 1234, 1000, 'ddp'), shipment(4, 5, 7, 0, 'exw')]
      }),
    )
    expect(m.trucks.map((t) => t.shippedDay)).toEqual([4, 6])
    expect(rowsOf(m, 'truck-4')).toEqual(['Arrives today', `7 units ${DOT} ${INCOTERM_TIER_NAMES.exw}`])
    expect(rowsOf(m, 'truck-6')).toEqual(['Arrives day 8', `${formatUnits(1234)} ${DOT} DDP`])
    expect(rowsOf(m, 'truck-6-lost')).toEqual([`${formatQty(1000)} lost in transit`])
    expect(has(m, 'truck-4-lost')).toBe(false)
  })

  it('lot labels: a bought lot keeps its id', () => {
    const m = buildSceneModel(variant((p) => void (p.view.cellar = [cellarLot('B60-11', 59, 90)])))
    expect(rowsOf(m, 'vat-B60-11')[0]).toBe(lotLabel('B60-11'))
    expect(rowsOf(m, 'vat-B60-11')[0]).toBe('Lot #B60-11')
    expect(m.vats[0].lotId).toBe('B60-11')
  })

  it('money stacks fill column, then row, then tier', () => {
    const m = buildSceneModel(variant((p) => void (p.view.cash = 16000)))
    expect(m.money).toHaveLength(16)
    m.money.forEach((pos, k) => {
      const tier = Math.floor(k / 8)
      const row = Math.floor((k % 8) / 4)
      const col = k % 4
      expectVec(pos, [1.8 + (col - 1.5) * 0.6, 1.1 + tier * 0.16, 8 + (row - 0.5) * 0.3])
    })
  })

  it('description pluralises lots, shipments and contracts', () => {
    const d = (lots: number, ships: number, contracts: number): string =>
      buildSceneModel(
        variant((p) => {
          p.view.cellar = mixedCellar(lots)
          p.view.in_transit = mixedShipments(ships, false)
          p.view.futures_book = manyContracts(contracts)
        }),
      ).description
    const tail = 'Every number is also in the panels.'
    expect(d(0, 0, 0)).toBe(`Your pulquería in 3D: no lots in the cellar, no shipments on the road, no open futures contracts. ${tail}`)
    expect(d(1, 1, 1)).toBe(`Your pulquería in 3D: 1 lot in the cellar, 1 shipment on the road, 1 open futures contract. ${tail}`)
    expect(d(12, 6, 14)).toBe(`Your pulquería in 3D: 12 lots in the cellar, 6 shipments on the road, 14 open futures contracts. ${tail}`)
  })

  it('nothing the table leaves out appears: rivals, customers, capacity, the disruption message', () => {
    const m = buildSceneModel(
      variant((p) => {
        briefOf(p).supplier.disrupted = true
        briefOf(p).supplier.disruption_message = DISRUPTION_MESSAGE
      }),
    )
    const text = m.signs.map((s) => s.text).join('\n')
    expect(text).not.toContain(RIVAL_NAME)
    expect(text).not.toContain('P2')
    expect(text).not.toContain(DISRUPTION_MESSAGE)
    expect(text.toLowerCase()).not.toMatch(/capacity|customer|rival/)
    expect(m.stations).toHaveLength(4)
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// Failure modes 5 to 8 (display scaling, absence, risk, order)
// ---------------------------------------------------------------------------------------------------------------------
describe('failure mode 5: a capped figure shown as the real one', () => {
  it('12 lots give five vats and "+7 more lots"', () => {
    const m = buildSceneModel(variant((p) => void (p.view.cellar = mixedCellar(12))))
    expect(m.vats).toHaveLength(5)
    expect(rowsOf(m, 'cellar-overflow')[0]).toBe('+7 more lots')
    expect(m.hidden.lots).toBe(7)
  })

  it('a lot of 99,999 units is full, and its sign says 99,999 units', () => {
    const m = buildSceneModel(variant((p) => void (p.view.cellar = [cellarLot('L9', 99999, 90)])))
    expect(m.vats[0].level).toBeCloseTo(1, 9)
    expect(rowsOf(m, 'vat-L9')[1]).toBe('99,999 units')
  })

  it('59 and 60 units: level just under 1, and exactly 1', () => {
    const m = buildSceneModel(variant((p) => void (p.view.cellar = [cellarLot('L1', 59, 90), cellarLot('L2', 60, 90)])))
    expect(m.vats[0].level).toBeCloseTo(59 / 60, 6)
    expect(m.vats[1].level).toBeCloseTo(1, 9)
    expect(rowsOf(m, 'vat-L1')[1]).toBe('59 units')
  })

  it('cash $9,999,999.99 gives 16 stacks and the full figure on the counter', () => {
    const m = buildSceneModel(variant((p) => void (p.view.cash = 9999999.99)))
    expect(m.money).toHaveLength(16)
    expect(rowsOf(m, 'counter-status')[0]).toContain('$9,999,999.99')
  })

  it('a truck sign carries the uncapped units and losses', () => {
    const m = buildSceneModel(variant((p) => void (p.view.in_transit = [shipment(7, 9, 99999, 99999, 'dap')])))
    expect(rowsOf(m, 'truck-7')[1]).toBe(`99,999 units ${DOT} DAP`)
    expect(rowsOf(m, 'truck-7-lost')[0]).toBe('99,999 lost in transit')
  })

  it('the hidden counts are exact for every overflow size', () => {
    const hidden = (lots: number, ships: number, contracts: number): SceneModel['hidden'] =>
      buildSceneModel(
        variant((p) => {
          p.view.cellar = mixedCellar(lots)
          p.view.in_transit = mixedShipments(ships, false)
          p.view.futures_book = manyContracts(contracts)
        }),
      ).hidden
    expect(hidden(6, 4, 5)).toEqual({ lots: 0, shipments: 0, contracts: 0 })
    expect(hidden(7, 5, 6)).toEqual({ lots: 2, shipments: 2, contracts: 2 })
    expect(hidden(12, 7, 14)).toEqual({ lots: 7, shipments: 4, contracts: 10 })
  })
})

describe('failure mode 6: an absent thing is left out, not drawn', () => {
  it('peer market off: no Peer market row', () => {
    const m = buildSceneModel(variant((p) => void (p.config.peer_market.enabled = false)))
    expect(rowsOf(m, 'board-market-body').some((r) => r.includes('Peer market'))).toBe(false)
  })

  it('not disrupted: no warning sign', () => {
    expect(has(F(), 'board-supplier-warning')).toBe(false)
  })

  it('lost 0: no lost sign', () => {
    const m = buildSceneModel(variant((p) => void (p.view.in_transit = [shipment(4, 5, 40, 0, 'cip')])))
    expect(ids(m).some((id) => id.endsWith('-lost'))).toBe(false)
    expect(sign(m, 'truck-4').rows).toHaveLength(2)
  })

  it('backlog 0: no Backlog', () => {
    const m = buildSceneModel(variant((p) => void (p.view.backlog = 0)))
    expect(sign(m, 'counter-status').text).not.toContain('Backlog')
  })

  it('a lot that is not conserved has no Conserved row', () => {
    expect(rowsOf(F(), 'vat-L3')).not.toContain('Conserved')
  })

  it('with lots present there is no empty-cellar sign; with shipments no empty-yard sign', () => {
    const m = F()
    expect(has(m, 'cellar-empty')).toBe(false)
    expect(has(m, 'yard-empty')).toBe(false)
    expect(has(m, 'cellar-overflow')).toBe(false)
    expect(has(m, 'yard-overflow')).toBe(false)
  })
})

describe('failure mode 7: risk and quality disagree', () => {
  const lotSign = (quality: number): { rows: readonly string[]; risk: string } => {
    const m = buildSceneModel(variant((p) => void (p.view.cellar = [cellarLot('L1', 20, quality)])))
    return { rows: rowsOf(m, 'vat-L1'), risk: m.vats[0].risk }
  }

  it('quality 57 reads 43% and At risk, never 44%', () => {
    const { rows, risk } = lotSign(57)
    expect(rows[2]).toBe('Risk tonight 43%')
    expect(rows[3]).toBe('At risk')
    expect(rows.join(' ')).not.toContain('44%')
    expect(risk).toBe('at_risk')
  })

  it('quality 100 reads 0% and Safe', () => {
    const { rows, risk } = lotSign(100)
    expect(rows[2]).toBe('Risk tonight 0%')
    expect(rows[3]).toBe('Safe')
    expect(risk).toBe('safe')
  })

  it('quality 0 reads 100% and Likely to spoil', () => {
    const { rows, risk } = lotSign(0)
    expect(rows[2]).toBe('Risk tonight 100%')
    expect(rows[3]).toBe('Likely to spoil')
    expect(risk).toBe('likely')
  })

  it('the 50% threshold: quality 50 is Likely to spoil, quality 51 is At risk', () => {
    expect(lotSign(50)).toMatchObject({ risk: 'likely' })
    expect(lotSign(50).rows[3]).toBe('Likely to spoil')
    expect(lotSign(51)).toMatchObject({ risk: 'at_risk' })
    expect(lotSign(51).rows[2]).toBe('Risk tonight 49%')
    expect(lotSign(51).rows[3]).toBe('At risk')
  })

  it('the risk word is the shared label for the state', () => {
    expect(lotSign(23).rows[3]).toBe(RISK_LABELS.likely)
    expect(lotSign(90).rows[3]).toBe(RISK_LABELS.at_risk)
    expect(lotSign(100).rows[3]).toBe(RISK_LABELS.safe)
  })

  it('a conserved lot says Conserved last', () => {
    const m = buildSceneModel(variant((p) => void (p.view.cellar = [cellarLot('L1', 20, 90, true)])))
    const rows = rowsOf(m, 'vat-L1')
    expect(rows[rows.length - 1]).toBe('Conserved')
    expect(m.vats[0].conserved).toBe(true)
  })
})

describe('failure mode 8: wrong order', () => {
  it('vats and their signs follow cellar order, however the quantities fall', () => {
    const m = buildSceneModel(
      variant((p) => {
        p.view.cellar = [cellarLot('L9', 5, 90), cellarLot('L2', 50, 90), cellarLot('B3-1', 20, 90)]
      }),
    )
    expect(m.vats.map((v) => v.lotId)).toEqual(['L9', 'L2', 'B3-1'])
    expect(m.vats.map((v) => v.position[0])).toEqual([-3, 0, 3])
    expect(ids(m).filter((id) => id.startsWith('vat-'))).toEqual(['vat-L9', 'vat-L2', 'vat-B3-1'])
  })

  it('trucks follow arrival order (arrival day, then shipped day), whatever order the props list them in', () => {
    const list = [
      shipment(9, 12, 10, 0, 'exw'),
      shipment(3, 6, 20, 0, 'cip'),
      shipment(8, 6, 30, 0, 'dap'),
      shipment(5, 7, 40, 0, 'ddp'),
    ]
    const expectedShipped = [3, 8, 5, 9]
    for (const order of [list, [...list].reverse(), [list[2], list[0], list[3], list[1]]]) {
      const m = buildSceneModel(variant((p) => void (p.view.in_transit = [...order])))
      expect(m.trucks.map((t) => t.shippedDay)).toEqual(expectedShipped)
      expect(m.trucks.map((t) => t.position[0])).toEqual([-6, -2, 2, 6])
      expect(ids(m).filter((id) => /^truck-\d+$/.test(id))).toEqual(expectedShipped.map((d) => `truck-${d}`))
    }
  })

  it('the overflow keeps the soonest arrivals', () => {
    const list = [1, 2, 3, 4, 5].map((i) => shipment(i, 20 - i, 10, 0, 'exw'))
    const m = buildSceneModel(variant((p) => void (p.view.in_transit = [...list])))
    expect(m.trucks.map((t) => t.shippedDay)).toEqual([5, 4, 3])
    expect(m.hidden.shipments).toBe(2)
  })

  it('futures rows follow delivery day, then contract day, whatever order the props list them in', () => {
    const list = [contract(2, 14, 1), contract(1, 9, 2), contract(3, 11, 3), contract(1, 11, 4), contract(2, 7, 5)]
    const expected = ['Day 7: 5 units', 'Day 9: 2 units', 'Day 11: 4 units', 'Day 11: 3 units', 'Day 14: 1 unit']
    for (const order of [list, [...list].reverse(), [list[3], list[0], list[4], list[2], list[1]]]) {
      const m = buildSceneModel(variant((p) => void (p.view.futures_book = [...order])))
      expect(rowsOf(m, 'board-futures-body')).toEqual(expected)
    }
  })

  it('with more than five contracts the four shown are the soonest', () => {
    const list = [9, 3, 7, 5, 11, 4, 8].map((d, i) => contract(1, d, i + 1))
    const m = buildSceneModel(variant((p) => void (p.view.futures_book = [...list])))
    expect(rowsOf(m, 'board-futures-body')).toEqual([
      'Day 3: 2 units',
      'Day 4: 6 units',
      'Day 5: 4 units',
      'Day 7: 3 units',
      '+3 more contracts',
    ])
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// Failure mode 11 and acceptance 7: purity
// ---------------------------------------------------------------------------------------------------------------------
describe('failure mode 11: an impure model', () => {
  it('equal props give deep-equal models (several variants)', () => {
    for (const { name, props } of sweepVariants().slice(0, 40)) {
      const again = sweepVariants().find((v) => v.name === name)
      expect(again, name).toBeDefined()
      expect(buildSceneModel(props), name).toEqual(buildSceneModel(again!.props))
    }
  })

  it('the same props object twice gives deep-equal models', () => {
    const p = maximalProps()
    expect(buildSceneModel(p)).toEqual(buildSceneModel(p))
  })

  it('a deeply frozen props object does not throw (shuffled lists included)', () => {
    const p = deepFreeze(
      variant((x) => {
        x.view.in_transit = mixedShipments(6, true)
        x.view.futures_book = manyContracts(9)
        x.view.cellar = mixedCellar(7)
      }),
    )
    expect(() => buildSceneModel(p)).not.toThrow()
    for (const { props } of sweepVariants()) {
      expect(() => buildSceneModel(deepFreeze(props))).not.toThrow()
    }
  })

  it('props are not mutated (unsorted lists stay unsorted)', () => {
    const p = variant((x) => {
      x.view.in_transit = mixedShipments(6, true)
      x.view.futures_book = manyContracts(9)
    })
    const before = JSON.stringify(p)
    buildSceneModel(p)
    expect(JSON.stringify(p)).toBe(before)
  })

  it('reads no randomness and no clock', () => {
    const random = vi.spyOn(Math, 'random')
    const now = vi.spyOn(Date, 'now')
    try {
      buildSceneModel(maximalProps())
      expect(random).not.toHaveBeenCalled()
      expect(now).not.toHaveBeenCalled()
    } finally {
      random.mockRestore()
      now.mockRestore()
    }
  })

  it('returns fresh data: editing a model leaves the next one untouched', () => {
    const a = F()
    a.signs[0].rows = ['changed']
    a.vats.length = 0
    a.stations[0].standOff = [1, 1, 1]
    expect(F()).toEqual(buildSceneModel(baseProps()))
    expect(F().vats).toHaveLength(3)
    expect(F().stations[0].standOff).toEqual(STAND_OFFS.decision)
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// The sweep: §3.6 invariants (acceptance 6) and the structural acceptance criteria 4 and 5
// ---------------------------------------------------------------------------------------------------------------------
const OBJECT_TOP = (id: string): number | null => {
  if (id.startsWith('vat-') || id === 'cellar-overflow') return VAT.height
  if (id === 'bin') return BIN.height
  if (/^truck-\d+(-lost)?$/.test(id) || id === 'yard-overflow') return TRUCK.height
  return null
}

const bottomOf = (s: SceneSign): number => s.position[1] - s.height / 2
const topOf = (s: SceneSign): number => s.position[1] + s.height / 2

/** 1. No two floating signs overlap. */
function overlapViolations(model: SceneModel, gap = SIGN_GAP): string[] {
  const out: string[] = []
  const floating = model.signs.filter((s) => s.floating)
  for (let i = 0; i < floating.length; i += 1) {
    for (let j = i + 1; j < floating.length; j += 1) {
      const a = floating[i]
      const b = floating[j]
      const dist = Math.hypot(a.position[0] - b.position[0], a.position[2] - b.position[2])
      if (dist >= (a.width + b.width) / 2 + gap - 1e-9) continue
      const vertical = Math.max(bottomOf(b) - topOf(a), bottomOf(a) - topOf(b))
      if (vertical >= STACK_GAP - 1e-9) continue
      out.push(`${a.id} overlaps ${b.id}`)
    }
  }
  return out
}

/** 2. Turning circles inside the walls. */
function wallViolations(model: SceneModel): string[] {
  const out: string[] = []
  for (const s of model.signs.filter((x) => x.floating)) {
    const reachX = Math.abs(s.position[0]) + s.width / 2
    const reachZ = Math.abs(s.position[2]) + s.width / 2
    if (reachX > HALL.halfWidth - WALL_CLEARANCE + 1e-9) out.push(`${s.id} reaches the east or west wall`)
    if (reachZ > HALL.halfDepth - WALL_CLEARANCE + 1e-9) out.push(`${s.id} reaches the north or south wall`)
  }
  return out
}

/** 3. Plates clear their objects (the clearance is the literal 0.4). */
function clearanceViolations(model: SceneModel): string[] {
  const out: string[] = []
  for (const s of model.signs) {
    const top = OBJECT_TOP(s.id)
    if (top !== null && bottomOf(s) < top + 0.4 - 1e-9) out.push(`${s.id} bottom ${bottomOf(s)} < ${top + 0.4}`)
  }
  const vatSigns = model.signs.filter((s) => s.id.startsWith('vat-') || s.id === 'cellar-overflow')
  const title = model.signs.find((s) => s.id === 'cellar-title')
  if (title && vatSigns.length > 0) {
    const highest = Math.max(...vatSigns.map(topOf))
    if (bottomOf(title) < highest + STACK_GAP - 1e-9) out.push('cellar-title is not above the highest vat sign')
  }
  for (const s of model.signs.filter((x) => x.id.endsWith('-lost'))) {
    const main = model.signs.find((x) => x.id === s.id.replace(/-lost$/, ''))
    if (!main) out.push(`${s.id} has no main sign`)
    else if (topOf(s) > bottomOf(main) - STACK_GAP + 1e-9) out.push(`${s.id} is not stacked under ${main.id}`)
  }
  return out
}

/** 4. Rows fit. */
function rowViolations(model: SceneModel): string[] {
  const out: string[] = []
  for (const s of model.signs) {
    for (const row of s.rows) {
      if (rowRun(row, s.size) > s.maxWidth + 1e-9) out.push(`${s.id}: "${row}" runs ${rowRun(row, s.size)} > ${s.maxWidth}`)
    }
  }
  return out
}

/** 5. Mounted text fits its surface. */
function mountedViolations(model: SceneModel): string[] {
  const out: string[] = []
  const innerTop = BOARD.centreY + BOARD.height / 2 - BOARD.frame
  const innerBottom = BOARD.centreY - BOARD.height / 2 + BOARD.frame
  for (const b of ['day-stats', 'market', 'supplier', 'futures']) {
    const block = model.signs.filter((s) => s.id.startsWith(`board-${b}-`))
    if (block.length === 0) continue
    const top = Math.max(...block.map(topOf))
    const bottom = Math.min(...block.map(bottomOf))
    if (top - bottom > BOARD_TEXT_HEIGHT + 1e-9) out.push(`${b}: block ${top - bottom} > ${BOARD_TEXT_HEIGHT}`)
    if (top > innerTop + 1e-9) out.push(`${b}: block top ${top} above the board`)
    if (bottom < innerBottom - 1e-9) out.push(`${b}: block bottom ${bottom} below the board`)
  }
  const counter = model.signs.filter((s) => s.id.startsWith('counter-'))
  if (counter.length > 0 && Math.min(...counter.map(bottomOf)) < 0.05 - 1e-9) out.push('counter text near the floor')
  return out
}

type Rect = { minX: number; maxX: number; minZ: number; maxZ: number }
const circleRectDistance = (cx: number, cz: number, r: Rect): number =>
  Math.hypot(cx - Math.min(Math.max(cx, r.minX), r.maxX), cz - Math.min(Math.max(cz, r.minZ), r.maxZ))
const truckRect = (x: number): Rect => ({
  minX: x - TRUCK.width / 2,
  maxX: x + TRUCK.width / 2,
  minZ: TRUCK.z - TRUCK.length / 2,
  maxZ: TRUCK.z + TRUCK.length / 2,
})
const ROAD: Rect = { minX: -2.5, maxX: 2.5, minZ: -Infinity, maxZ: -12 }
const OUTER = HALL.halfDepth + HALL.wallThickness
const WALLS_OUTER: Rect = {
  minX: -(HALL.halfWidth + HALL.wallThickness),
  maxX: HALL.halfWidth + HALL.wallThickness,
  minZ: -OUTER,
  maxZ: OUTER,
}

/** 6. Objects stay apart and inside. */
function objectViolations(model: SceneModel, vatPitchOverride?: number): string[] {
  const out: string[] = []
  const vats = model.vats.map((v, i) => ({
    x: vatPitchOverride === undefined ? v.position[0] : v.position[0] * (vatPitchOverride / VAT.pitch),
    z: v.position[2],
    id: model.vats[i].lotId,
  }))
  for (let i = 0; i < vats.length; i += 1) {
    for (let j = i + 1; j < vats.length; j += 1) {
      if (Math.hypot(vats[i].x - vats[j].x, vats[i].z - vats[j].z) < 2 * VAT.radius - 1e-9) out.push(`vat ${vats[i].id} meets ${vats[j].id}`)
    }
    if (Math.hypot(vats[i].x - BIN.x, vats[i].z - BIN.z) < VAT.radius + BIN.radiusTop - 1e-9) out.push(`vat ${vats[i].id} meets the bin`)
    for (const t of model.trucks) {
      if (circleRectDistance(vats[i].x, vats[i].z, truckRect(t.position[0])) < VAT.radius - 1e-9) out.push(`vat ${vats[i].id} meets truck ${t.shippedDay}`)
    }
    if (Math.abs(vats[i].x) + VAT.radius > HALL.halfWidth + 1e-9 || Math.abs(vats[i].z) + VAT.radius > HALL.halfDepth + 1e-9) out.push(`vat ${vats[i].id} outside the walls`)
  }
  if (Math.abs(BIN.x) + BIN.radiusTop > HALL.halfWidth || Math.abs(BIN.z) + BIN.radiusTop > HALL.halfDepth) out.push('bin outside the walls')
  for (const t of model.trucks) {
    const r = truckRect(t.position[0])
    if (Math.max(Math.abs(r.minX), Math.abs(r.maxX)) > HALL.halfWidth + 1e-9 || Math.max(Math.abs(r.minZ), Math.abs(r.maxZ)) > HALL.halfDepth + 1e-9) {
      out.push(`truck ${t.shippedDay} outside the walls`)
    }
  }
  AGAVES.forEach((a, i) => {
    const r = AGAVE_REACH * a.scale
    if (circleRectDistance(a.x, a.z, ROAD) < r - 1e-9) out.push(`agave ${i} on the road`)
    if (i < 4) {
      if (Math.abs(a.x) + r > HALL.halfWidth + 1e-9 || Math.abs(a.z) + r > HALL.halfDepth + 1e-9) out.push(`agave ${i} outside the walls`)
      for (const t of model.trucks) {
        if (circleRectDistance(a.x, a.z, truckRect(t.position[0])) < r - 1e-9) out.push(`agave ${i} meets truck ${t.shippedDay}`)
      }
    } else if (a.z + r > -OUTER + 1e-9) {
      out.push(`agave ${i} not north of the wall`)
    }
  })
  TREES.forEach((t, i) => {
    if (circleRectDistance(t.x, t.z, WALLS_OUTER) < TREE_REACH - 1e-9) out.push(`tree ${i} touches the walls`)
  })
  return out
}

/** 7. Stations. */
function stationViolations(model: SceneModel, interact = INTERACT_DISTANCE): string[] {
  const out: string[] = []
  const s = model.stations
  for (const a of s) {
    const [x, , z] = a.standOff
    if (x < MOVEMENT_BOUNDS.minX || x > MOVEMENT_BOUNDS.maxX || z < MOVEMENT_BOUNDS.minZ || z > MOVEMENT_BOUNDS.maxZ) out.push(`${a.id} outside the bounds`)
    if (Math.hypot(x - SPAWN.position[0], z - SPAWN.position[2]) <= interact) out.push(`spawn within reach of ${a.id}`)
  }
  for (let i = 0; i < s.length; i += 1) {
    for (let j = i + 1; j < s.length; j += 1) {
      const d = Math.hypot(s[i].standOff[0] - s[j].standOff[0], s[i].standOff[2] - s[j].standOff[2])
      if (d < 2 * interact) out.push(`${s[i].id} and ${s[j].id} compete (${d})`)
    }
  }
  return out
}

/** 8. Budget. */
function budgetViolations(model: SceneModel, maxSigns = MAX_SIGNS, maxCalls = MAX_DRAW_CALLS): string[] {
  const out: string[] = []
  if (model.signs.length > maxSigns) out.push(`${model.signs.length} signs > ${maxSigns}`)
  if (estimateDrawCalls(model) > maxCalls) out.push(`${estimateDrawCalls(model)} draw calls > ${maxCalls}`)
  return out
}

const SWEEP = sweepVariants().map((v) => ({ name: v.name, model: buildSceneModel(v.props), props: v.props }))

function sweepAll(check: (model: SceneModel) => string[]): string[] {
  return SWEEP.flatMap(({ name, model }) => check(model).map((v) => `${name}: ${v}`))
}

describe('the sweep covers what §6 asks for', () => {
  it('has the variety it claims', () => {
    expect(SWEEP.length).toBeGreaterThan(100)
    const cellarSizes = new Set(SWEEP.map((s) => s.props.view.cellar.length))
    for (const n of [0, 1, 2, 5, 6, 7, 12]) expect(cellarSizes.has(n)).toBe(true)
    const shipSizes = new Set(SWEEP.map((s) => s.props.view.in_transit.length))
    for (let n = 0; n <= 7; n += 1) expect(shipSizes.has(n)).toBe(true)
    const contractSizes = new Set(SWEEP.map((s) => s.props.view.futures_book.length))
    for (const n of [0, 1, 5, 6, 14]) expect(contractSizes.has(n)).toBe(true)
    const cashes = new Set(SWEEP.map((s) => s.props.view.cash))
    for (const c of [-999999.99, 0, 999.99, 16000, 9999999.99]) expect(cashes.has(c)).toBe(true)
    expect(SWEEP.some((s) => s.props.view.brief === null)).toBe(true)
    expect(SWEEP.some((s) => s.props.view.yesterday === null)).toBe(true)
    expect(SWEEP.some((s) => s.props.view.day === 60 && s.props.view.duration_days === 60)).toBe(true)
  })
})

describe('failure mode 1: overlapping signs', () => {
  it('no two floating signs overlap anywhere in the sweep', () => {
    expect(sweepAll((m) => overlapViolations(m))).toEqual([])
  })

  it('the check can fail: vats at pitch 2.4 and trucks at pitch 3.4 are caught', () => {
    const vats = SWEEP.find((s) => s.name === 'extremes cellar 6 shipments 0')!.model
    const squeezed = clone(vats)
    for (const s of squeezed.signs.filter((x) => x.id.startsWith('vat-'))) s.position = [s.position[0] * (2.4 / VAT.pitch), s.position[1], s.position[2]]
    expect(overlapViolations(squeezed).length).toBeGreaterThan(0)

    const trucks = SWEEP.find((s) => s.name === 'shipments 4 big')!.model
    const near = clone(trucks)
    for (const s of near.signs.filter((x) => x.id.startsWith('truck-'))) s.position = [s.position[0] * (3.4 / TRUCK.pitch), s.position[1], s.position[2]]
    expect(overlapViolations(near).length).toBeGreaterThan(0)
  })

  it('the check passes on stacked signs at exactly STACK_GAP (the main and lost sign of one truck)', () => {
    const m = F()
    expect(overlapViolations(m)).toEqual([])
    expect(sign(m, 'truck-4-lost').position[0]).toBe(sign(m, 'truck-4').position[0])
  })
})

describe('failure mode 2: a sign through a wall', () => {
  it('every turning circle stays inside the walls', () => {
    expect(sweepAll(wallViolations)).toEqual([])
  })

  it('the check can fail: the bin sign moved to x = -11 is caught', () => {
    const m = clone(F())
    const bin = sign(m, 'bin')
    bin.position = [-11, bin.position[1], bin.position[2]]
    expect(wallViolations(m).length).toBeGreaterThan(0)
  })

  it('the bin sign in its real place clears the west wall', () => {
    const bin = sign(F(), 'bin')
    expect(Math.abs(bin.position[0]) + bin.width / 2).toBeLessThanOrEqual(HALL.halfWidth - WALL_CLEARANCE + 1e-9)
  })
})

describe('failure mode 3: a sign inside its object', () => {
  it('every plate clears its object by 0.4 (a literal), the cellar title clears the vat signs, lost signs sit under main signs', () => {
    expect(sweepAll(clearanceViolations)).toEqual([])
  })

  it('the check can fail: clearance 0 and a lost sign stacked above the main sign are caught', () => {
    const m = clone(SWEEP.find((s) => s.name === 'extremes cellar 6 shipments 4')!.model)
    const lowered = clone(m)
    for (const s of lowered.signs.filter((x) => x.id.startsWith('vat-'))) s.position = [s.position[0], VAT.height + s.height / 2, s.position[2]]
    expect(clearanceViolations(lowered).length).toBeGreaterThan(0)

    const flipped = clone(m)
    const main = sign(flipped, 'truck-40')
    const lost = sign(flipped, 'truck-40-lost')
    const y = main.position[1]
    main.position = [main.position[0], lost.position[1], main.position[2]]
    lost.position = [lost.position[0], y, lost.position[2]]
    expect(clearanceViolations(flipped).length).toBeGreaterThan(0)
  })

  it('in F the lost sign is below the main sign and the title above the vat signs', () => {
    const m = F()
    expect(sign(m, 'truck-4-lost').position[1]).toBeLessThan(sign(m, 'truck-4').position[1])
    expect(bottomOf(sign(m, 'cellar-title'))).toBeGreaterThanOrEqual(topOf(sign(m, 'vat-L5')) + STACK_GAP - 1e-9)
    expect(CELLAR_TITLE_Y).toBeGreaterThan(0)
  })
})

describe('failure mode 4: a row that wraps', () => {
  it('every row of every sign fits its maxWidth, at the extremes', () => {
    expect(sweepAll(rowViolations)).toEqual([])
  })

  it('the check can fail: the counter status at size 0.26 is caught', () => {
    const m = clone(SWEEP.find((s) => s.name === 'extremes cellar 6 shipments 4')!.model)
    expect(sign(m, 'counter-status').text).toContain('$9,999,999.99')
    expect(sign(m, 'counter-status').text).toContain('99,999 units')
    sign(m, 'counter-status').size = 0.26
    expect(rowViolations(m).length).toBeGreaterThan(0)
  })

  it('the extreme counter status really is long (the check is not trivially satisfied)', () => {
    const m = SWEEP.find((s) => s.name === 'extremes cellar 6 shipments 4')!.model
    const status = sign(m, 'counter-status')
    expect(rowRun(status.rows[0], status.size)).toBeGreaterThan(4.5)
  })

  it('every sign states the width it was checked against, from the layout constants', () => {
    const m = F()
    expect(sign(m, 'counter-status').maxWidth).toBe(COUNTER.textMaxWidth)
  })
})

describe('mounted text fits its surface (invariant 5)', () => {
  it('boards and counter', () => {
    expect(sweepAll(mountedViolations)).toEqual([])
  })

  it('the check can fail: a block pushed below the board is caught', () => {
    const m = clone(F())
    for (const s of m.signs.filter((x) => x.id.startsWith('board-supplier-'))) s.position = [s.position[0], s.position[1] - 2, s.position[2]]
    expect(mountedViolations(m).length).toBeGreaterThan(0)
  })
})

describe('objects stay apart and inside (invariant 6)', () => {
  it('vats, bin, trucks, agaves and trees', () => {
    expect(sweepAll((m) => objectViolations(m))).toEqual([])
  })

  it('the check can fail: vats at pitch 1.2 intersect', () => {
    const m = SWEEP.find((s) => s.name === 'cellar 6')!.model
    expect(objectViolations(m, 1.2).length).toBeGreaterThan(0)
  })
})

describe('failure mode 9: stations unreachable or competing', () => {
  it('every stand-off is in bounds, 6 m apart, and clear of the spawn', () => {
    expect(sweepAll((m) => stationViolations(m))).toEqual([])
  })

  it('the check can fail: INTERACT_DISTANCE 4 is caught', () => {
    expect(stationViolations(F(), 4).length).toBeGreaterThan(0)
  })

  it('the check can fail: a stand-off outside the bounds is caught', () => {
    const m = clone(F())
    m.stations[1].standOff = [-12, 0, 4]
    expect(stationViolations(m).length).toBeGreaterThan(0)
  })
})

describe('failure mode 10: budget', () => {
  it('signs and draw calls stay within the budget across the sweep', () => {
    expect(sweepAll((m) => budgetViolations(m))).toEqual([])
  })

  it('the maximal variant uses 27 signs and 48 draw calls, within 30 and 60', () => {
    const m = buildSceneModel(maximalProps())
    expect(m.signs).toHaveLength(27)
    expect(estimateDrawCalls(m)).toBe(FIXED_DRAW_CALLS + 27)
    expect(budgetViolations(m)).toEqual([])
    expect(m.signs.length).toBeGreaterThan(20)
  })

  it('the check can fail: MAX_SIGNS 20 is caught at the maximal variant', () => {
    expect(budgetViolations(buildSceneModel(maximalProps()), 20).length).toBeGreaterThan(0)
  })

  it('estimateDrawCalls is FIXED_DRAW_CALLS plus the sign count', () => {
    const m = F()
    expect(estimateDrawCalls(m)).toBe(FIXED_DRAW_CALLS + m.signs.length)
    expect(estimateDrawCalls({ ...m, signs: m.signs.slice(0, 3) })).toBe(FIXED_DRAW_CALLS + 3)
  })
})

// ---------------------------------------------------------------------------------------------------------------------
// Acceptance 4 and 5 over the sweep
// ---------------------------------------------------------------------------------------------------------------------
const RANK: [RegExp, number][] = [
  [/^counter-title$/, 0],
  [/^counter-status$/, 1],
  [/^board-day-stats-title$/, 2],
  [/^board-day-stats-body$/, 3],
  [/^board-market-title$/, 4],
  [/^board-market-body$/, 5],
  [/^board-supplier-title$/, 6],
  [/^board-supplier-body$/, 7],
  [/^board-supplier-warning$/, 8],
  [/^board-futures-title$/, 9],
  [/^board-futures-body$/, 10],
  [/^cellar-title$/, 11],
  [/^vat-.+$/, 12],
  [/^cellar-(overflow|empty)$/, 13],
  [/^bin$/, 14],
  [/^truck-\d+(-lost)?$/, 15],
  [/^yard-(overflow|empty)$/, 16],
]
const rankOf = (id: string): number => {
  const hit = RANK.find(([re]) => re.test(id))
  if (!hit) throw new Error(`unknown sign id ${id}`)
  return hit[1]
}

function expectedKind(id: string): { size: number; colour: string; floating: boolean; maxWidth: number } {
  if (id === 'counter-title') return { size: SIGN_SIZE.counterTitle, colour: 'chalk', floating: false, maxWidth: COUNTER.textMaxWidth }
  if (id === 'counter-status') return { size: SIGN_SIZE.counterRow, colour: 'chalk', floating: false, maxWidth: COUNTER.textMaxWidth }
  const board = /^board-(day-stats|market|supplier|futures)-(title|body|warning)$/.exec(id)
  if (board) {
    return {
      size: board[2] === 'title' ? SIGN_SIZE.boardTitle : SIGN_SIZE.boardRow,
      colour: board[2] === 'warning' ? 'chalkWarning' : 'chalk',
      floating: false,
      maxWidth: boardTextMaxWidth(BOARD_SPOTS[board[1] as keyof typeof BOARD_SPOTS].width),
    }
  }
  if (id === 'cellar-title') return { size: SIGN_SIZE.title, colour: 'ink', floating: true, maxWidth: SIGN_MAX_WIDTH.title }
  if (id === 'cellar-empty' || id === 'yard-empty') return { size: SIGN_SIZE.empty, colour: 'ink', floating: true, maxWidth: SIGN_MAX_WIDTH.empty }
  if (id.endsWith('-lost')) return { size: SIGN_SIZE.row, colour: 'danger', floating: true, maxWidth: SIGN_MAX_WIDTH.truck }
  if (id === 'bin') return { size: SIGN_SIZE.row, colour: 'ink', floating: true, maxWidth: SIGN_MAX_WIDTH.bin }
  if (id.startsWith('truck-') || id === 'yard-overflow') return { size: SIGN_SIZE.row, colour: 'ink', floating: true, maxWidth: SIGN_MAX_WIDTH.truck }
  return { size: SIGN_SIZE.row, colour: 'ink', floating: true, maxWidth: SIGN_MAX_WIDTH.vat }
}

describe('structure of every model in the sweep (acceptance 3, 4, 5)', () => {
  it('ids are unique and follow §3.4 order; a lost sign follows its main sign', () => {
    const problems: string[] = []
    for (const { name, model } of SWEEP) {
      const list = ids(model)
      if (new Set(list).size !== list.length) problems.push(`${name}: duplicate ids`)
      const ranks = list.map(rankOf)
      if (ranks.some((r, i) => i > 0 && r < ranks[i - 1])) problems.push(`${name}: out of order ${list.join(',')}`)
      list.forEach((id, i) => {
        if (id.endsWith('-lost') && list[i - 1] !== id.replace(/-lost$/, '')) problems.push(`${name}: ${id} not after its truck`)
      })
      for (const must of ['counter-title', 'counter-status', 'board-day-stats-title', 'board-day-stats-body', 'board-market-title', 'board-market-body', 'board-supplier-title', 'board-futures-title', 'board-futures-body', 'cellar-title', 'bin']) {
        if (!list.includes(must)) problems.push(`${name}: missing ${must}`)
      }
    }
    expect(problems).toEqual([])
  })

  it('text, width and height follow the rows; size, colour, floating and maxWidth follow the kind', () => {
    const problems: string[] = []
    for (const { name, model } of SWEEP) {
      for (const s of model.signs) {
        const where = `${name}/${s.id}`
        if (s.rows.length === 0) problems.push(`${where}: no rows`)
        if (s.rows.some((r) => r.length === 0)) problems.push(`${where}: empty row`)
        if (s.text !== s.rows.join('\n')) problems.push(`${where}: text`)
        const [w, h] = textBlockSize(s.rows, s.size, s.floating)
        if (Math.abs(w - s.width) > 1e-6 || Math.abs(h - s.height) > 1e-6) problems.push(`${where}: size`)
        const k = expectedKind(s.id)
        if (s.size !== k.size) problems.push(`${where}: size ${s.size} != ${k.size}`)
        if (s.colour !== k.colour) problems.push(`${where}: colour ${s.colour}`)
        if (s.floating !== k.floating) problems.push(`${where}: floating`)
        if (Math.abs(s.maxWidth - k.maxWidth) > 1e-9) problems.push(`${where}: maxWidth ${s.maxWidth}`)
        if (s.floating && s.rotationY !== 0) problems.push(`${where}: floating rotationY`)
      }
    }
    expect(problems).toEqual([])
  })

  it('signs stand over their objects and mounted text on its surface', () => {
    const problems: string[] = []
    for (const { name, model } of SWEEP) {
      for (const s of model.signs) {
        const where = `${name}/${s.id}`
        const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6
        if (s.id.startsWith('vat-')) {
          const v = model.vats.find((x) => `vat-${x.lotId}` === s.id)
          if (!v || !near(v.position[0], s.position[0]) || !near(s.position[2], VAT.z)) problems.push(`${where}: not over its vat`)
        } else if (/^truck-\d+$/.test(s.id) || /^truck-\d+-lost$/.test(s.id)) {
          const day = Number(/^truck-(\d+)/.exec(s.id)![1])
          const t = model.trucks.find((x) => x.shippedDay === day)
          if (!t || !near(t.position[0], s.position[0]) || !near(s.position[2], TRUCK.z)) problems.push(`${where}: not over its truck`)
        } else if (s.id === 'bin') {
          if (!near(s.position[0], BIN.x) || !near(s.position[2], BIN.z)) problems.push(`${where}: not over the bin`)
        } else if (s.id === 'cellar-title') {
          if (!near(s.position[0], 0) || !near(s.position[1], CELLAR_TITLE_Y) || !near(s.position[2], VAT.z)) problems.push(`${where}: misplaced`)
        } else if (s.id === 'cellar-empty') {
          if (!near(s.position[0], 0) || !near(s.position[1], EMPTY_SIGN_Y) || !near(s.position[2], VAT.z)) problems.push(`${where}: misplaced`)
        } else if (s.id === 'yard-empty') {
          if (!near(s.position[0], 0) || !near(s.position[1], EMPTY_SIGN_Y) || !near(s.position[2], TRUCK.z)) problems.push(`${where}: misplaced`)
        } else if (s.id === 'cellar-overflow') {
          if (!near(s.position[0], centredRow(5, 6, VAT.pitch)) || !near(s.position[2], VAT.z)) problems.push(`${where}: misplaced`)
        } else if (s.id === 'yard-overflow') {
          if (!near(s.position[0], centredRow(3, 4, TRUCK.pitch)) || !near(s.position[2], TRUCK.z)) problems.push(`${where}: misplaced`)
        } else if (s.id.startsWith('counter-')) {
          if (!near(s.position[0], COUNTER.x) || !near(s.position[2], 8.47) || s.rotationY !== 0) problems.push(`${where}: misplaced`)
        } else {
          const b = /^board-(day-stats|market|supplier|futures)-/.exec(s.id)![1] as keyof typeof BOARD_SPOTS
          const spot = BOARD_SPOTS[b]
          const off = BOARD.frameDepth + BOARD.faceDepth + 0.02
          if (!near(s.position[0], spot.x + Math.sin(spot.rotationY) * off) || !near(s.position[2], spot.z + Math.cos(spot.rotationY) * off) || !near(s.rotationY, spot.rotationY)) {
            problems.push(`${where}: misplaced`)
          }
        }
      }
    }
    expect(problems).toEqual([])
  })

  it('counts: vats, trucks, money, contacts, hidden and the description follow the props', () => {
    const problems: string[] = []
    for (const { name, props, model } of SWEEP) {
      const lots = props.view.cellar.length
      const ships = props.view.in_transit.length
      const contracts = props.view.futures_book.length
      const vats = lots <= 6 ? lots : 5
      const trucks = ships <= 4 ? ships : 3
      if (model.vats.length !== vats) problems.push(`${name}: vats ${model.vats.length}`)
      if (model.trucks.length !== trucks) problems.push(`${name}: trucks ${model.trucks.length}`)
      if (model.hidden.lots !== (lots > 6 ? lots - 5 : 0)) problems.push(`${name}: hidden lots`)
      if (model.hidden.shipments !== (ships > 4 ? ships - 3 : 0)) problems.push(`${name}: hidden shipments`)
      if (model.hidden.contracts !== (contracts > 5 ? contracts - 4 : 0)) problems.push(`${name}: hidden contracts`)
      if (model.money.length !== cashStacks(props.view.cash)) problems.push(`${name}: money`)
      if (model.contacts.length !== 1 + vats + 1 + trucks) problems.push(`${name}: contacts`)
      if (model.stations.length !== 4) problems.push(`${name}: stations`)
      if (has(model, 'cellar-empty') !== (lots === 0)) problems.push(`${name}: cellar-empty`)
      if (has(model, 'cellar-overflow') !== (lots > 6)) problems.push(`${name}: cellar-overflow`)
      if (has(model, 'yard-empty') !== (ships === 0)) problems.push(`${name}: yard-empty`)
      if (has(model, 'yard-overflow') !== (ships > 4)) problems.push(`${name}: yard-overflow`)
      const lostCount = props.view.in_transit.slice().sort((a, b) => a.arrives_day - b.arrives_day || a.shipped_day - b.shipped_day).slice(0, trucks).filter((s) => s.lost > 0).length
      if (ids(model).filter((id) => id.endsWith('-lost')).length !== lostCount) problems.push(`${name}: lost signs`)
      const lotsText = lots === 0 ? 'no lots in the cellar' : lots === 1 ? '1 lot in the cellar' : `${lots} lots in the cellar`
      const shipText = ships === 0 ? 'no shipments' : ships === 1 ? '1 shipment' : `${ships} shipments`
      const conText = contracts === 0 ? 'no open futures contracts' : contracts === 1 ? '1 open futures contract' : `${contracts} open futures contracts`
      if (model.description !== `Your pulquería in 3D: ${lotsText}, ${shipText} on the road, ${conText}. Every number is also in the panels.`) problems.push(`${name}: description`)
    }
    expect(problems).toEqual([])
  })

  it('the sign copy uses only the font file\'s Latin subset (no arrows, triangles or emoji)', () => {
    const allowed = /^[\n\x20-\x7eÀ-ſ·×−]*$/
    const bad = SWEEP.flatMap(({ name, model }) => model.signs.filter((s) => !allowed.test(s.text)).map((s) => `${name}/${s.id}: ${s.text}`))
    expect(bad).toEqual([])
  })

  it('the 12 lots and 5-contract variants show the uncapped figures in text', () => {
    const m = SWEEP.find((s) => s.name === 'cellar 12')!.model
    expect(rowsOf(m, 'cellar-overflow')[0]).toBe('+7 more lots')
    expect(m.description).toContain('12 lots in the cellar')
  })

  it('vat levels and risks follow the lots', () => {
    for (const { name, props, model } of SWEEP) {
      const drawn = props.view.cellar.slice(0, model.vats.length)
      drawn.forEach((lot, i) => {
        expect(model.vats[i].lotId, name).toBe(lot.id)
        expect(model.vats[i].level, name).toBeCloseTo(Math.min(Math.max(lot.qty, 0), 60) / 60, 9)
        expect(model.vats[i].conserved, name).toBe(lot.conserved)
        const risk = (100 - lot.quality) / 100
        expect(model.vats[i].risk, name).toBe(risk >= 0.5 ? 'likely' : risk > 0 ? 'at_risk' : 'safe')
        expect(rowsOf(model, `vat-${lot.id}`)[2], name).toBe(`Risk tonight ${formatPercent(risk)}`)
      })
    }
  })
})
