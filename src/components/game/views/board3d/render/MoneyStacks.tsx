import { useLayoutEffect, useRef, type ReactElement } from 'react'
import type { BufferGeometry, InstancedMesh, Material } from 'three'
import { CASH_STACK_CAP, MONEY, type Vec3 } from '../sceneLayout'
import { finishPool, placeInstance } from './geometry'

interface MoneyStacksProps {
  money: readonly Vec3[]
  model: { geometry: BufferGeometry; material: Material }
}

/** The counter's cash: the baked money model, one instance per stack. */
export default function MoneyStacks({ money, model }: MoneyStacksProps): ReactElement {
  const mesh = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const pool = mesh.current
    if (!pool) return
    money.forEach((position, i) => placeInstance(pool, i, position, MONEY.rotationY))
    finishPool(pool, money.length)
  }, [money])

  return <instancedMesh ref={mesh} args={[model.geometry, model.material, CASH_STACK_CAP]} />
}
