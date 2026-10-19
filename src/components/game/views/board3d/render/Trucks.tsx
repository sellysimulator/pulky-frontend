import { useLayoutEffect, useRef, type ReactElement } from 'react'
import type { BufferGeometry, InstancedMesh } from 'three'
import { TRUCK_SLOTS } from '../sceneLayout'
import type { SceneTruck } from '../sceneModel'
import { finishPool, placeInstance } from './geometry'
import { MATERIALS } from './materials'

/** One baked truck per shipment in transit. */
export default function Trucks({ trucks, geometry }: { trucks: readonly SceneTruck[]; geometry: BufferGeometry }): ReactElement {
  const mesh = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const pool = mesh.current
    if (!pool) return
    trucks.forEach((truck, i) => placeInstance(pool, i, truck.position, truck.rotationY))
    finishPool(pool, trucks.length)
  }, [trucks])

  return <instancedMesh ref={mesh} args={[geometry, MATERIALS.vertexColoured, TRUCK_SLOTS]} />
}
