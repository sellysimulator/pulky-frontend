import {
  CanvasTexture,
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three'
import { SCENE_HEX } from '../scenePalette'

/** design.md §14.3. */
export const HEMISPHERE_INTENSITY = 2.8

const TILE_PIXELS = 128
const TILE_LINE_PIXELS = 4

function flat(color: string, extra: ConstructorParameters<typeof MeshStandardMaterial>[0] = {}): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...extra })
}

function tileTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = TILE_PIXELS
  canvas.height = TILE_PIXELS
  const context = canvas.getContext('2d')
  if (context) {
    context.fillStyle = SCENE_HEX.floorTile
    context.fillRect(0, 0, TILE_PIXELS, TILE_PIXELS)
    context.fillStyle = SCENE_HEX.tileLine
    context.fillRect(0, 0, TILE_PIXELS, TILE_LINE_PIXELS)
    context.fillRect(0, TILE_PIXELS - TILE_LINE_PIXELS, TILE_PIXELS, TILE_LINE_PIXELS)
    context.fillRect(0, 0, TILE_LINE_PIXELS, TILE_PIXELS)
    context.fillRect(TILE_PIXELS - TILE_LINE_PIXELS, 0, TILE_LINE_PIXELS, TILE_PIXELS)
  }
  const texture = new CanvasTexture(canvas)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(24, 23)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

export const MATERIALS = {
  ground: flat(SCENE_HEX.ground),
  tiledFloor: flat('white', { map: tileTexture() }),
  yard: flat(SCENE_HEX.yard),
  road: flat(SCENE_HEX.road),
  walls: flat(SCENE_HEX.walls),
  wallBand: flat(SCENE_HEX.wallBand),
  woodDark: flat(SCENE_HEX.woodDark),
  woodLight: flat(SCENE_HEX.woodLight),
  boardFace: flat(SCENE_HEX.boardFace),
  bin: flat(SCENE_HEX.bin),
  vat: flat(SCENE_HEX.vat, { flatShading: true, side: DoubleSide }),
  hoops: flat('white', { flatShading: true, side: DoubleSide }),
  pulque: flat(SCENE_HEX.pulque, { roughness: 0.35 }),
  cover: flat(SCENE_HEX.cover),
  agave: flat(SCENE_HEX.agave, { flatShading: true }),
  vertexColoured: new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }),
  plate: new MeshBasicMaterial({
    color: SCENE_HEX.plate,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    side: DoubleSide,
  }),
  contact: new MeshBasicMaterial({ color: SCENE_HEX.contact, transparent: true, opacity: 0.16, depthWrite: false }),
}
