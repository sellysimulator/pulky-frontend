import type { ReactElement } from 'react'
import { BIN } from '../sceneLayout'
import { GEOMETRY } from './geometry'
import { MATERIALS } from './materials'

export default function SalvageBin(): ReactElement {
  return <mesh geometry={GEOMETRY.bin} material={MATERIALS.bin} position={[BIN.x, BIN.height / 2, BIN.z]} />
}
