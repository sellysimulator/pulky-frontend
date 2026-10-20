export type Vec3 = readonly [number, number, number]
export type StationId = 'decision' | 'day-stats' | 'market' | 'cellar'
export type PanelId = 'day-stats' | 'yesterday' | 'decision' | 'cellar' | 'market' | 'details'
export type BoardId = 'day-stats' | 'market' | 'supplier' | 'futures'

/** The walled compound. The inner wall faces are at x = ±halfWidth and z = ±halfDepth. */
export const HALL = {
  width: 24,
  depth: 36,
  halfWidth: 12,
  halfDepth: 18,
  wallHeight: 4.5,
  wallThickness: 0.3,
  eyeHeight: 1.7,
} as const
export const GATE_HALF_WIDTH = 3
export const YARD_EDGE_Z = -5
export const LAYER_Y = { ground: 0, floor: 0.01, road: 0.02, contact: 0.03 } as const
export const SURFACE_TEXT_OFFSET = 0.02
export const MOVEMENT_BOUNDS = { minX: -9.5, maxX: 9.5, minZ: -15.5, maxZ: 15.5 } as const
export const SPAWN = { position: [0, 1.7, 14] as Vec3, yaw: 0, pitch: -0.08 } as const
export const INTERACT_DISTANCE = 3
export const STAND_OFFS: Record<StationId, Vec3> = {
  decision: [0, 0, 10.5],
  'day-stats': [-9.5, 0, 4],
  market: [9.5, 0, 4],
  cellar: [0, 0, 3],
}
export const STATION_PANEL: Record<StationId, PanelId> = {
  decision: 'decision',
  'day-stats': 'day-stats',
  market: 'market',
  cellar: 'cellar',
}
export const PANEL_ORDER: readonly PanelId[] = [
  'day-stats',
  'yesterday',
  'decision',
  'cellar',
  'market',
  'details',
]
export const PANEL_TITLES: Record<PanelId, string> = {
  'day-stats': 'Day stats',
  yesterday: 'Yesterday',
  decision: "Today's decision",
  cellar: 'Your cellar',
  market: 'Market',
  details: 'Details',
}

export const COUNTER = {
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
} as const
export const COUNTER_TOP_Y = 1.1
export const MONEY = {
  columns: 4,
  rows: 2,
  tiers: 2,
  pitchX: 0.6,
  pitchZ: 0.3,
  pitchY: 0.16,
  centreX: 1.8,
  rotationY: Math.PI / 2,
} as const
export const CASH_PER_STACK = 1000
export const CASH_STACK_CAP = 16

export const BOARD = {
  height: 3,
  centreY: 2.45,
  frame: 0.12,
  frameDepth: 0.08,
  faceDepth: 0.02,
  padding: 0.15,
} as const
export const BOARD_SPOTS: Record<
  BoardId,
  { x: number; z: number; rotationY: number; width: number }
> = {
  'day-stats': { x: -12, z: 4, rotationY: Math.PI / 2, width: 5 },
  market: { x: 12, z: 4, rotationY: -Math.PI / 2, width: 5 },
  supplier: { x: -7.5, z: -18, rotationY: 0, width: 6 },
  futures: { x: 7.5, z: -18, rotationY: 0, width: 6 },
}
export const BOARD_TEXT_HEIGHT = 2.46
export function boardTextMaxWidth(width: number): number {
  return width - 2 * BOARD.frame - 2 * BOARD.padding
}

export const VAT = { radius: 0.7, height: 1, floorY: 0.12, liquidTopY: 0.92, z: 0, pitch: 3 } as const
export const VAT_SLOTS = 6
export const VAT_FULL_UNITS = 60
export const CELLAR_TITLE_Y = 3.85
export const EMPTY_SIGN_Y = 1.6
export const BIN = { x: -10.2, z: -3, radiusTop: 0.45, radiusBottom: 0.4, height: 0.9 } as const
export const TRUCK = {
  z: -9.5,
  pitch: 4,
  length: 5,
  width: 1.46,
  height: 1.91,
  rotationY: 0,
} as const
export const TRUCK_SLOTS = 4
export const FUTURES_ROWS = 5

export const TREES: readonly { x: number; z: number; rotationY: number }[] = [
  { x: -15.5, z: -8, rotationY: 0 },
  { x: 15.5, z: 2, rotationY: 1.9 },
  { x: -15.5, z: 13, rotationY: 4.1 },
]

const AGAVE_SCALES = [1, 0.9, 1.1, 1.2] as const
const AGAVE_POINTS: readonly (readonly [number, number])[] = [
  [-10.5, -13],
  [10.5, -13],
  [-10.5, -7],
  [10.5, -7],
  ...[-23, -27, -31, -35].flatMap((z) =>
    [-7, -4.5, 4.5, 7].map((x): readonly [number, number] => [x, z]),
  ),
]
export const AGAVES: readonly { x: number; z: number; rotationY: number; scale: number }[] =
  AGAVE_POINTS.map(([x, z], i) => ({
    x,
    z,
    rotationY: i * 0.7,
    scale: AGAVE_SCALES[i % 4],
  }))
export const AGAVE_REACH = 0.93
export const TREE_REACH = 2.5

export const SIGN_SIZE = {
  title: 0.42,
  row: 0.26,
  empty: 0.3,
  boardTitle: 0.36,
  boardRow: 0.26,
  counterTitle: 0.34,
  counterRow: 0.22,
} as const
export const SIGN_MAX_WIDTH = { vat: 2.6, truck: 3.4, bin: 2.7, title: 4, empty: 7 } as const
export const GLYPH_ADVANCE = 0.58
export const LINE_HEIGHT = 1.5
export const PLATE_MARGIN = 0.25
export const PLATE_OFFSET = 0.02
export const STACK_GAP = 0.12
export const SIGN_CLEARANCE = 0.4
export const SIGN_GAP = 0.2
export const WALL_CLEARANCE = 0.3

export const FIXED_DRAW_CALLS = 21
export const MAX_SIGNS = 30
export const MAX_DRAW_CALLS = 60

/** (index − (count − 1) ÷ 2) × pitch */
export function centredRow(index: number, count: number, pitch: number): number {
  return (index - (count - 1) / 2) * pitch
}

export function rowRun(row: string, size: number): number {
  return row.length * GLYPH_ADVANCE * size
}

/** [width, height]; a floating sign adds its plate margin on every side. */
export function textBlockSize(
  rows: readonly string[],
  size: number,
  floating: boolean,
): readonly [number, number] {
  const width = rows.reduce((max, row) => Math.max(max, rowRun(row, size)), 0)
  const height = size + (rows.length - 1) * size * LINE_HEIGHT
  const pad = floating ? 2 * PLATE_MARGIN * size : 0
  return [width + pad, height + pad]
}
