import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef, type ReactElement } from 'react'
import { Vector3, type InstancedMesh } from 'three'
import { MAX_SIGNS, PLATE_OFFSET } from '../sceneLayout'
import type { SceneSign } from '../sceneModel'
import { finishPool, GEOMETRY, placeInstance } from './geometry'
import { MATERIALS } from './materials'
import { BILLBOARD_GROUPS, BILLBOARD_YAW } from './signBillboard'

const direction = new Vector3()

function writePool(mesh: InstancedMesh, signs: readonly SceneSign[], yaw: number): void {
  let index = 0
  for (const sign of signs) {
    if (!sign.floating) continue
    const [x, y, z] = sign.position
    placeInstance(mesh, index, [x - Math.sin(yaw) * PLATE_OFFSET, y, z - Math.cos(yaw) * PLATE_OFFSET], yaw, [sign.width, sign.height, 1])
    index += 1
  }
  finishPool(mesh, index)
}

/**
 * The plates behind the floating signs, and the one per-frame hook that turns every sign: one yaw from the camera's view
 * direction, applied to all of them at once, and nothing at all while the camera has not turned.
 */
export default function SignPlates({ signs }: { signs: readonly SceneSign[] }): ReactElement {
  const mesh = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    if (mesh.current) writePool(mesh.current, signs, BILLBOARD_YAW.value)
  }, [signs])

  useFrame(({ camera }) => {
    camera.getWorldDirection(direction)
    const yaw = Math.atan2(-direction.x, -direction.z)
    if (yaw === BILLBOARD_YAW.value) return
    BILLBOARD_YAW.value = yaw
    for (const group of BILLBOARD_GROUPS) group.rotation.y = yaw
    if (mesh.current) writePool(mesh.current, signs, yaw)
  })

  return <instancedMesh ref={mesh} args={[GEOMETRY.plate, MATERIALS.plate, MAX_SIGNS]} />
}
