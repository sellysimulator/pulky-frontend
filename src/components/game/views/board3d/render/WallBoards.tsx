import type { ReactElement } from 'react'
import { GEOMETRY } from './geometry'
import { MATERIALS } from './materials'

/** The four boards' frames and faces; the text on them is the signs'. */
export default function WallBoards(): ReactElement {
  return (
    <>
      <mesh geometry={GEOMETRY.boardFrames} material={MATERIALS.woodDark} />
      <mesh geometry={GEOMETRY.boardFaces} material={MATERIALS.boardFace} />
    </>
  )
}
