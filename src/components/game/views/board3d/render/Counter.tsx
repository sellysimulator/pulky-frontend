import type { ReactElement } from 'react'
import { COUNTER } from '../sceneLayout'
import { GEOMETRY } from './geometry'
import { MATERIALS } from './materials'

export default function Counter(): ReactElement {
  return (
    <>
      <mesh geometry={GEOMETRY.counterBody} material={MATERIALS.woodDark} position={[COUNTER.x, COUNTER.bodyHeight / 2, COUNTER.z]} />
      <mesh
        geometry={GEOMETRY.counterTop}
        material={MATERIALS.woodLight}
        position={[COUNTER.x, COUNTER.bodyHeight + COUNTER.topThickness / 2, COUNTER.z]}
      />
    </>
  )
}
