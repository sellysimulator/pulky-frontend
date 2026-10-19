import {
  formatMoney,
  formatPercent,
  formatQty,
  formatUnits,
  INCOTERM_TIER_NAMES,
  lotLabel,
  riskFromQuality,
  riskState,
  RISK_LABELS,
  weekdayLong,
} from '../../../../utils/format'
import type { BoardViewProps } from '../Board2D'
import {
  BIN,
  BOARD,
  BOARD_SPOTS,
  BOARD_TEXT_HEIGHT,
  boardTextMaxWidth,
  CASH_PER_STACK,
  CASH_STACK_CAP,
  CELLAR_TITLE_Y,
  centredRow,
  COUNTER,
  COUNTER_TOP_Y,
  EMPTY_SIGN_Y,
  FIXED_DRAW_CALLS,
  FUTURES_ROWS,
  LAYER_Y,
  MONEY,
  PANEL_TITLES,
  SIGN_CLEARANCE,
  SIGN_MAX_WIDTH,
  SIGN_SIZE,
  STACK_GAP,
  STAND_OFFS,
  STATION_PANEL,
  SURFACE_TEXT_OFFSET,
  textBlockSize,
  TRUCK,
  TRUCK_SLOTS,
  VAT,
  VAT_FULL_UNITS,
  VAT_SLOTS,
  type BoardId,
  type PanelId,
  type StationId,
  type Vec3,
} from './sceneLayout'

export type RiskStateId = 'safe' | 'at_risk' | 'likely'
export type SignColour = 'ink' | 'danger' | 'chalk' | 'chalkWarning'

export interface SceneSign {
  id: string
  rows: readonly string[]
  text: string
  size: number
  colour: SignColour
  position: Vec3
  rotationY: number
  floating: boolean
  maxWidth: number
  width: number
  height: number
}
export interface SceneVat {
  lotId: string
  position: Vec3
  level: number
  risk: RiskStateId
  conserved: boolean
}
export interface SceneTruck {
  shippedDay: number
  arrivesDay: number
  position: Vec3
  rotationY: number
}
export interface SceneStation {
  id: StationId
  panel: PanelId
  title: string
  standOff: Vec3
}
export interface SceneContact {
  position: Vec3
  sizeX: number
  sizeZ: number
}
export interface SceneModel {
  vats: SceneVat[]
  trucks: SceneTruck[]
  money: Vec3[]
  signs: SceneSign[]
  stations: SceneStation[]
  contacts: SceneContact[]
  hidden: { lots: number; shipments: number; contracts: number }
  description: string
}

export function vatLevel(qty: number): number {
  return Math.min(Math.max(qty, 0), VAT_FULL_UNITS) / VAT_FULL_UNITS
}

export function cashStacks(cash: number): number {
  if (cash <= 0) return 0
  return Math.min(CASH_STACK_CAP, Math.floor(cash / CASH_PER_STACK))
}

/** `signs` in reading order, top first; the last sign's bottom sits at `baseY`. */
export function stackUp(baseY: number, signs: readonly SceneSign[]): SceneSign[] {
  const out: SceneSign[] = new Array<SceneSign>(signs.length)
  let bottom = baseY
  for (let i = signs.length - 1; i >= 0; i--) {
    const s = signs[i]
    out[i] = { ...s, position: [s.position[0], bottom + s.height / 2, s.position[2]] }
    bottom += s.height + STACK_GAP
  }
  return out
}

/** `signs` in reading order, top first; the first sign's top sits at `topY`. */
export function stackDown(topY: number, signs: readonly SceneSign[]): SceneSign[] {
  let top = topY
  return signs.map((s) => {
    const placed: SceneSign = {
      ...s,
      position: [s.position[0], top - s.height / 2, s.position[2]],
    }
    top -= s.height + STACK_GAP
    return placed
  })
}

export function estimateDrawCalls(model: SceneModel): number {
  return FIXED_DRAW_CALLS + model.signs.length
}

interface SignSpec {
  id: string
  rows: readonly string[]
  size: number
  colour: SignColour
  x: number
  z: number
  rotationY?: number
  floating: boolean
  maxWidth: number
  y?: number
}

function makeSign(spec: SignSpec): SceneSign {
  const [width, height] = textBlockSize(spec.rows, spec.size, spec.floating)
  return {
    id: spec.id,
    rows: spec.rows,
    text: spec.rows.join('\n'),
    size: spec.size,
    colour: spec.colour,
    position: [spec.x, spec.y ?? 0, spec.z],
    rotationY: spec.floating ? 0 : (spec.rotationY ?? 0),
    floating: spec.floating,
    maxWidth: spec.maxWidth,
    width,
    height,
  }
}

function floatingSign(
  id: string,
  rows: readonly string[],
  size: number,
  colour: SignColour,
  maxWidth: number,
  x: number,
  z: number,
  y?: number,
): SceneSign {
  return makeSign({ id, rows, size, colour, x, z, floating: true, maxWidth, y })
}

function countPhrase(n: number, none: string, one: string, many: (n: number) => string): string {
  if (n === 0) return none
  if (n === 1) return one
  return many(n)
}

interface BoardContent {
  title: string
  body: string[]
  warning: string[]
}

function boardSigns(id: BoardId, content: BoardContent): SceneSign[] {
  const spot = BOARD_SPOTS[id]
  const offset = BOARD.frameDepth + BOARD.faceDepth + SURFACE_TEXT_OFFSET
  const x = spot.x + Math.sin(spot.rotationY) * offset
  const z = spot.z + Math.cos(spot.rotationY) * offset
  const maxWidth = boardTextMaxWidth(spot.width)
  const mk = (suffix: string, rows: string[], size: number, colour: SignColour): SceneSign =>
    makeSign({
      id: `board-${id}-${suffix}`,
      rows,
      size,
      colour,
      x,
      z,
      rotationY: spot.rotationY,
      floating: false,
      maxWidth,
    })
  const list = [mk('title', [content.title], SIGN_SIZE.boardTitle, 'chalk')]
  if (content.body.length > 0) list.push(mk('body', content.body, SIGN_SIZE.boardRow, 'chalk'))
  if (content.warning.length > 0)
    list.push(mk('warning', content.warning, SIGN_SIZE.boardRow, 'chalkWarning'))
  return stackDown(BOARD.centreY + BOARD_TEXT_HEIGHT / 2, list)
}

export function buildSceneModel(props: BoardViewProps): SceneModel {
  const { view, publicHistory, config } = props
  const brief = view.brief
  const signs: SceneSign[] = []

  // Counter.
  const counterZ = COUNTER.z + COUNTER.depth / 2 + SURFACE_TEXT_OFFSET
  const status =
    `Cash ${formatMoney(view.cash)}` +
    (view.backlog > 0 ? ` · Backlog ${formatUnits(view.backlog)}` : '')
  const counterMk = (id: string, text: string, size: number): SceneSign =>
    makeSign({
      id,
      rows: [text],
      size,
      colour: 'chalk',
      x: COUNTER.x,
      z: counterZ,
      rotationY: 0,
      floating: false,
      maxWidth: COUNTER.textMaxWidth,
    })
  signs.push(
    ...stackDown(COUNTER.textTop, [
      counterMk('counter-title', "Today's decision", SIGN_SIZE.counterTitle),
      counterMk('counter-status', status, SIGN_SIZE.counterRow),
    ]),
  )

  const money: Vec3[] = []
  for (let k = 0; k < cashStacks(view.cash); k++) {
    const tier = Math.floor(k / 8)
    const row = Math.floor((k % 8) / 4)
    const col = k % 4
    money.push([
      MONEY.centreX + centredRow(col, MONEY.columns, MONEY.pitchX),
      COUNTER_TOP_Y + tier * MONEY.pitchY,
      COUNTER.z + centredRow(row, MONEY.rows, MONEY.pitchZ),
    ])
  }

  // Chalkboard.
  const dayStats: string[] = [
    `Day ${view.day}/${view.duration_days} · ${weekdayLong(view.weekday)}`,
  ]
  if (brief) dayStats.push(`Weekday ×${brief.weekday_multiplier.toFixed(2)}`)
  dayStats.push(`Your demand ~${formatQty(Math.round(view.expected_demand_own))}`)
  if (brief) dayStats.push(`Spot price ${formatMoney(brief.supplier.spot_price)}`)
  dayStats.push(`Reputation ${view.reputation.toFixed(2)}`)
  signs.push(...boardSigns('day-stats', { title: 'Day stats', body: dayStats, warning: [] }))

  // Market board.
  const last = publicHistory.length > 0 ? publicHistory[publicHistory.length - 1] : undefined
  const mine = last?.players[view.alias]
  const marketRows: string[] = []
  if (!last || !mine) {
    marketRows.push('No results yet')
  } else {
    marketRows.push(
      `Sold yesterday: ${formatUnits(mine.units_sold)}`,
      `Your share: ${formatPercent(mine.market_share)}`,
      `Market sold: ${formatUnits(last.units_sold_total)}`,
    )
    if (config.peer_market.enabled) {
      if (last.peer_units > 0) {
        marketRows.push(
          `Peer market: ${formatUnits(last.peer_units)}`,
          `at ${formatMoney(last.peer_avg_price ?? 0)} on average`,
        )
      } else {
        marketRows.push('Peer market: no trades')
      }
    }
  }
  signs.push(...boardSigns('market', { title: 'Market', body: marketRows, warning: [] }))

  // Supplier board.
  const supplierRows: string[] = []
  const supplierWarning: string[] = []
  if (brief) {
    supplierRows.push(
      `Spot price ${formatMoney(brief.supplier.spot_price)}/unit`,
      `Base price ${formatMoney(brief.supplier.base_price)}/unit`,
      brief.spot.open ? `Spot order arrives day ${brief.spot.arrives_day}` : 'Spot orders closed',
    )
    if (brief.transport.shared) supplierRows.push('Shared transport')
    if (brief.supplier.disrupted) supplierWarning.push('Disrupted today')
  }
  signs.push(
    ...boardSigns('supplier', { title: 'Supplier', body: supplierRows, warning: supplierWarning }),
  )

  // Futures board.
  const contracts = [...view.futures_book].sort(
    (a, b) => a.delivery_day - b.delivery_day || a.contract_day - b.contract_day,
  )
  const futuresRows: string[] = []
  let hiddenContracts = 0
  if (contracts.length === 0) {
    futuresRows.push('No open futures.')
  } else if (contracts.length > FUTURES_ROWS) {
    const shown = FUTURES_ROWS - 1
    for (const c of contracts.slice(0, shown))
      futuresRows.push(`Day ${c.delivery_day}: ${formatUnits(c.qty)}`)
    hiddenContracts = contracts.length - shown
    futuresRows.push(`+${hiddenContracts} more contracts`)
  } else {
    for (const c of contracts) futuresRows.push(`Day ${c.delivery_day}: ${formatUnits(c.qty)}`)
  }
  signs.push(...boardSigns('futures', { title: 'Futures book', body: futuresRows, warning: [] }))

  // Tinacal.
  signs.push(
    floatingSign(
      'cellar-title',
      ['Your cellar'],
      SIGN_SIZE.title,
      'ink',
      SIGN_MAX_WIDTH.title,
      0,
      VAT.z,
      CELLAR_TITLE_Y,
    ),
  )
  const vats: SceneVat[] = []
  const contacts: SceneContact[] = [
    {
      position: [COUNTER.x, LAYER_Y.contact, COUNTER.z],
      sizeX: COUNTER.topWidth + 0.4,
      sizeZ: COUNTER.topDepth + 0.4,
    },
  ]
  const cellar = view.cellar
  const lotCount = cellar.length
  const drawnLots = lotCount > VAT_SLOTS ? VAT_SLOTS - 1 : lotCount
  const lotSlots = lotCount > VAT_SLOTS ? VAT_SLOTS : lotCount
  for (let i = 0; i < drawnLots; i++) {
    const lot = cellar[i]
    const x = centredRow(i, lotSlots, VAT.pitch)
    const risk = riskState(riskFromQuality(lot.quality))
    vats.push({
      lotId: lot.id,
      position: [x, 0, VAT.z],
      level: vatLevel(lot.qty),
      risk,
      conserved: lot.conserved,
    })
    contacts.push({
      position: [x, LAYER_Y.contact, VAT.z],
      sizeX: 2 * VAT.radius + 0.3,
      sizeZ: 2 * VAT.radius + 0.3,
    })
    const rows = [
      lotLabel(lot.id),
      formatUnits(lot.qty),
      `Risk tonight ${formatPercent(riskFromQuality(lot.quality))}`,
      RISK_LABELS[risk],
    ]
    if (lot.conserved) rows.push('Conserved')
    const [sign] = stackUp(VAT.height + SIGN_CLEARANCE, [
      floatingSign(`vat-${lot.id}`, rows, SIGN_SIZE.row, 'ink', SIGN_MAX_WIDTH.vat, x, VAT.z),
    ])
    signs.push(sign)
  }
  let hiddenLots = 0
  if (lotCount > VAT_SLOTS) {
    hiddenLots = lotCount - drawnLots
    const [sign] = stackUp(VAT.height + SIGN_CLEARANCE, [
      floatingSign(
        'cellar-overflow',
        [`+${hiddenLots} more lots`, 'See Your cellar'],
        SIGN_SIZE.row,
        'ink',
        SIGN_MAX_WIDTH.vat,
        centredRow(VAT_SLOTS - 1, VAT_SLOTS, VAT.pitch),
        VAT.z,
      ),
    ])
    signs.push(sign)
  } else if (lotCount === 0) {
    signs.push(
      floatingSign(
        'cellar-empty',
        ['The cellar is empty', 'Stock arrives with your next delivery.'],
        SIGN_SIZE.empty,
        'ink',
        SIGN_MAX_WIDTH.empty,
        0,
        VAT.z,
        EMPTY_SIGN_Y,
      ),
    )
  }

  // Salvage bin.
  const y = view.yesterday
  const binRows = ['Spoiled overnight', formatUnits(y?.spoiled ?? 0)]
  if (y && y.revenue_salvage > 0) binRows.push('Salvaged for', formatMoney(y.revenue_salvage))
  contacts.push({
    position: [BIN.x, LAYER_Y.contact, BIN.z],
    sizeX: 2 * BIN.radiusTop + 0.3,
    sizeZ: 2 * BIN.radiusTop + 0.3,
  })
  signs.push(
    ...stackUp(BIN.height + SIGN_CLEARANCE, [
      floatingSign('bin', binRows, SIGN_SIZE.row, 'ink', SIGN_MAX_WIDTH.bin, BIN.x, BIN.z),
    ]),
  )

  // Yard.
  const shipments = [...view.in_transit].sort(
    (a, b) => a.arrives_day - b.arrives_day || a.shipped_day - b.shipped_day,
  )
  const trucks: SceneTruck[] = []
  const shipCount = shipments.length
  const drawnShips = shipCount > TRUCK_SLOTS ? TRUCK_SLOTS - 1 : shipCount
  const shipSlots = shipCount > TRUCK_SLOTS ? TRUCK_SLOTS : shipCount
  for (let i = 0; i < drawnShips; i++) {
    const s = shipments[i]
    const x = centredRow(i, shipSlots, TRUCK.pitch)
    trucks.push({
      shippedDay: s.shipped_day,
      arrivesDay: s.arrives_day,
      position: [x, 0, TRUCK.z],
      rotationY: TRUCK.rotationY,
    })
    contacts.push({
      position: [x, LAYER_Y.contact, TRUCK.z],
      sizeX: TRUCK.width + 0.4,
      sizeZ: TRUCK.length + 0.4,
    })
    const main = floatingSign(
      `truck-${s.shipped_day}`,
      [
        s.arrives_day === view.day ? 'Arrives today' : `Arrives day ${s.arrives_day}`,
        `${formatUnits(s.qty)} · ${INCOTERM_TIER_NAMES[s.incoterm_tier]}`,
      ],
      SIGN_SIZE.row,
      'ink',
      SIGN_MAX_WIDTH.truck,
      x,
      TRUCK.z,
    )
    const stack = [main]
    if (s.lost > 0) {
      stack.push(
        floatingSign(
          `truck-${s.shipped_day}-lost`,
          [`${formatQty(s.lost)} lost in transit`],
          SIGN_SIZE.row,
          'danger',
          SIGN_MAX_WIDTH.truck,
          x,
          TRUCK.z,
        ),
      )
    }
    signs.push(...stackUp(TRUCK.height + SIGN_CLEARANCE, stack))
  }
  let hiddenShipments = 0
  if (shipCount > TRUCK_SLOTS) {
    hiddenShipments = shipCount - drawnShips
    signs.push(
      ...stackUp(TRUCK.height + SIGN_CLEARANCE, [
        floatingSign(
          'yard-overflow',
          [`+${hiddenShipments} more shipments`, 'See Your cellar'],
          SIGN_SIZE.row,
          'ink',
          SIGN_MAX_WIDTH.truck,
          centredRow(TRUCK_SLOTS - 1, TRUCK_SLOTS, TRUCK.pitch),
          TRUCK.z,
        ),
      ]),
    )
  } else if (shipCount === 0) {
    signs.push(
      floatingSign(
        'yard-empty',
        ['Nothing in transit.'],
        SIGN_SIZE.empty,
        'ink',
        SIGN_MAX_WIDTH.empty,
        0,
        TRUCK.z,
        EMPTY_SIGN_Y,
      ),
    )
  }

  const stations: SceneStation[] = (
    ['decision', 'day-stats', 'market', 'cellar'] as const
  ).map((id) => ({
    id,
    panel: STATION_PANEL[id],
    title: PANEL_TITLES[STATION_PANEL[id]],
    standOff: STAND_OFFS[id],
  }))

  const description =
    `Your pulquería in 3D: ` +
    `${countPhrase(lotCount, 'no lots in the cellar', '1 lot in the cellar', (n) => `${n} lots in the cellar`)}, ` +
    `${countPhrase(shipCount, 'no shipments', '1 shipment', (n) => `${n} shipments`)} on the road, ` +
    `${countPhrase(view.futures_book.length, 'no open futures contracts', '1 open futures contract', (n) => `${n} open futures contracts`)}. ` +
    `Every number is also in the panels.`

  return {
    vats,
    trucks,
    money,
    signs,
    stations,
    contacts,
    hidden: { lots: hiddenLots, shipments: hiddenShipments, contracts: hiddenContracts },
    description,
  }
}
