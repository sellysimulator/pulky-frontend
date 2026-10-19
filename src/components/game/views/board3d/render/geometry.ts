import {
  BoxGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  LatheGeometry,
  Object3D,
  PlaneGeometry,
  TorusGeometry,
  Vector2,
  type BufferGeometry,
  type InstancedMesh,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { BIN, BOARD, BOARD_SPOTS, COUNTER, GATE_HALF_WIDTH, HALL } from '../sceneLayout'

function merge(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts)
  for (const part of parts) part.dispose()
  if (!merged) throw new Error('geometry: the parts could not be merged')
  return merged
}

function box(width: number, height: number, depth: number, x: number, y: number, z: number, turn = 0): BufferGeometry {
  const geometry = new BoxGeometry(width, height, depth)
  geometry.rotateY(turn)
  geometry.translate(x, y, z)
  return geometry
}

function floorPlane(width: number, depth: number): PlaneGeometry {
  const plane = new PlaneGeometry(width, depth)
  plane.rotateX(-Math.PI / 2)
  return plane
}

/** The five wall boxes; the band repeats them lower and a little thicker. */
function wallBoxes(height: number, centreY: number, thickness: number): BufferGeometry[] {
  const { halfWidth: hw, halfDepth: hd, wallThickness: t } = HALL
  const g = GATE_HALF_WIDTH
  const piece = hw + t - g
  return [
    box(2 * hw + 2 * t, height, thickness, 0, centreY, hd + t / 2),
    box(thickness, height, 2 * hd + 2 * t, -(hw + t / 2), centreY, 0),
    box(thickness, height, 2 * hd + 2 * t, hw + t / 2, centreY, 0),
    box(piece, height, thickness, -(g + piece / 2), centreY, -(hd + t / 2)),
    box(piece, height, thickness, g + piece / 2, centreY, -(hd + t / 2)),
  ]
}

function boards(): { frames: BufferGeometry; faces: BufferGeometry } {
  const frames: BufferGeometry[] = []
  const faces: BufferGeometry[] = []
  for (const spot of Object.values(BOARD_SPOTS)) {
    const nx = Math.sin(spot.rotationY)
    const nz = Math.cos(spot.rotationY)
    const frameReach = BOARD.frameDepth / 2
    const faceReach = BOARD.frameDepth + BOARD.faceDepth / 2
    frames.push(
      box(spot.width, BOARD.height, BOARD.frameDepth, spot.x + nx * frameReach, BOARD.centreY, spot.z + nz * frameReach, spot.rotationY),
    )
    faces.push(
      box(
        spot.width - 2 * BOARD.frame,
        BOARD.height - 2 * BOARD.frame,
        BOARD.faceDepth,
        spot.x + nx * faceReach,
        BOARD.centreY,
        spot.z + nz * faceReach,
        spot.rotationY,
      ),
    )
  }
  return { frames: merge(frames), faces: merge(faces) }
}

function vatBody(): BufferGeometry {
  const profile = [
    [0, 0],
    [0.66, 0],
    [0.7, 0.5],
    [0.68, 1],
    [0.6, 1],
    [0.62, 0.5],
    [0.58, 0.12],
    [0, 0.12],
  ].map(([r, y]) => new Vector2(r, y))
  return new LatheGeometry(profile, 24)
}

function vatHoops(): BufferGeometry {
  const rings = [
    { y: 0.2, radius: 0.686 },
    { y: 0.5, radius: 0.71 },
    { y: 0.8, radius: 0.698 },
  ].map(({ y, radius }) => {
    const ring = new TorusGeometry(radius, 0.035, 6, 32)
    ring.rotateX(Math.PI / 2)
    ring.translate(0, y, 0)
    return ring
  })
  return merge(rings)
}

function agave(): BufferGeometry {
  const leaves: BufferGeometry[] = []
  const leaf = (tilt: number, turn: number): void => {
    const cone = new ConeGeometry(0.11, 1.1, 4)
    cone.translate(0, 0.55, 0)
    cone.scale(1, 1, 0.35)
    cone.rotateZ(tilt)
    cone.rotateY(turn)
    leaves.push(cone)
  }
  for (let i = 0; i < 6; i += 1) leaf(0.55, (i * Math.PI) / 3)
  for (let i = 0; i < 6; i += 1) leaf(1.0, Math.PI / 6 + (i * Math.PI) / 3)
  return merge(leaves)
}

function pulqueDisc(): BufferGeometry {
  const disc = new CircleGeometry(0.58, 32)
  disc.rotateX(-Math.PI / 2)
  return disc
}

function cover(): BufferGeometry {
  const cylinder = new CylinderGeometry(0.73, 0.73, 0.05, 24)
  cylinder.translate(0, 1.025, 0)
  return cylinder
}

function contact(): BufferGeometry {
  const circle = new CircleGeometry(0.5, 32)
  circle.rotateX(-Math.PI / 2)
  return circle
}

const BOARD_GEOMETRY = boards()

export const GEOMETRY = {
  ground: floorPlane(240, 240),
  tiledFloor: floorPlane(24, 23),
  yardFloor: floorPlane(24, 13),
  road: floorPlane(5, 68),
  walls: merge(wallBoxes(HALL.wallHeight, HALL.wallHeight / 2, HALL.wallThickness)),
  wallBand: merge(wallBoxes(1, 0.5, HALL.wallThickness + 0.02)),
  counterBody: new BoxGeometry(COUNTER.width, COUNTER.bodyHeight, COUNTER.depth),
  counterTop: new BoxGeometry(COUNTER.topWidth, COUNTER.topThickness, COUNTER.topDepth),
  boardFrames: BOARD_GEOMETRY.frames,
  boardFaces: BOARD_GEOMETRY.faces,
  vatBody: vatBody(),
  vatHoops: vatHoops(),
  pulque: pulqueDisc(),
  cover: cover(),
  bin: new CylinderGeometry(BIN.radiusTop, BIN.radiusBottom, BIN.height, 16),
  agave: agave(),
  contact: contact(),
  plate: new PlaneGeometry(1, 1),
}

// Scratch objects shared by every pool write: nothing is allocated per write.
const scratch = new Object3D()
const scratchColour = new Color()

/** Sets instance `index` to a position, a turn about y and a scale. */
export function placeInstance(
  mesh: InstancedMesh,
  index: number,
  position: readonly [number, number, number],
  turn = 0,
  scale: readonly [number, number, number] = [1, 1, 1],
): void {
  scratch.position.set(position[0], position[1], position[2])
  scratch.rotation.set(0, turn, 0)
  scratch.scale.set(scale[0], scale[1], scale[2])
  scratch.updateMatrix()
  mesh.setMatrixAt(index, scratch.matrix)
}

export function colourInstance(mesh: InstancedMesh, index: number, hex: string): void {
  mesh.setColorAt(index, scratchColour.set(hex))
}

/** After a write: the matrices (and colours) are uploaded and the culling sphere covers every instance. */
export function finishPool(mesh: InstancedMesh, count: number): void {
  mesh.count = count
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.computeBoundingSphere()
}
