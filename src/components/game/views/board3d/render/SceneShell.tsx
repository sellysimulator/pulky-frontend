import type { ReactElement } from 'react'
import { LAYER_Y } from '../sceneLayout'
import { GEOMETRY } from './geometry'
import { MATERIALS } from './materials'

/** Ground, floors, road, walls and the band along their foot: six meshes, each flat layer at its own height. */
export default function SceneShell(): ReactElement {
  return (
    <>
      <mesh geometry={GEOMETRY.ground} material={MATERIALS.ground} position={[0, LAYER_Y.ground, 0]} />
      <mesh geometry={GEOMETRY.tiledFloor} material={MATERIALS.tiledFloor} position={[0, LAYER_Y.floor, 6.5]} />
      <mesh geometry={GEOMETRY.yardFloor} material={MATERIALS.yard} position={[0, LAYER_Y.floor, -11.5]} />
      <mesh geometry={GEOMETRY.road} material={MATERIALS.road} position={[0, LAYER_Y.road, -46]} />
      <mesh geometry={GEOMETRY.walls} material={MATERIALS.walls} />
      <mesh geometry={GEOMETRY.wallBand} material={MATERIALS.wallBand} />
    </>
  )
}
