import { useLayoutEffect, useRef, type ReactElement } from 'react'
import type { BufferGeometry, InstancedMesh } from 'three'
import { AGAVES, TREES } from '../sceneLayout'
import { finishPool, GEOMETRY, placeInstance } from './geometry'
import { MATERIALS } from './materials'

/** Decoration only: three trees outside the walls, agave in the yard and in the fields beyond the gate. */
export default function Decor({ tree }: { tree: BufferGeometry }): ReactElement {
  const trees = useRef<InstancedMesh>(null)
  const agaves = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    if (trees.current) {
      TREES.forEach((spot, i) => placeInstance(trees.current as InstancedMesh, i, [spot.x, 0, spot.z], spot.rotationY))
      finishPool(trees.current, TREES.length)
    }
    if (agaves.current) {
      AGAVES.forEach((spot, i) =>
        placeInstance(agaves.current as InstancedMesh, i, [spot.x, 0, spot.z], spot.rotationY, [spot.scale, spot.scale, spot.scale]),
      )
      finishPool(agaves.current, AGAVES.length)
    }
  }, [])

  return (
    <>
      <instancedMesh ref={trees} args={[tree, MATERIALS.vertexColoured, TREES.length]} />
      <instancedMesh ref={agaves} args={[GEOMETRY.agave, MATERIALS.agave, AGAVES.length]} />
    </>
  )
}
