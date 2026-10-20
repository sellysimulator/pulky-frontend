import { Text } from '@react-three/drei'
import FIGTREE_600 from '@fontsource/figtree/files/figtree-latin-600-normal.woff?url'
import { useLayoutEffect, useRef, type ReactElement } from 'react'
import type { Group } from 'three'
import { LINE_HEIGHT } from '../sceneLayout'
import { SIGN_HEX } from '../scenePalette'
import type { SceneSign as SceneSignData } from '../sceneModel'
import { BILLBOARD_GROUPS, BILLBOARD_YAW } from './signBillboard'

/** One sign: SDF text in the shipped font, never wrapped, at the width the model sized its plate for. */
export default function SceneSign({ sign }: { sign: SceneSignData }): ReactElement {
  const group = useRef<Group>(null)

  useLayoutEffect(() => {
    const current = group.current
    if (!current || !sign.floating) return
    BILLBOARD_GROUPS.add(current)
    return () => {
      BILLBOARD_GROUPS.delete(current)
    }
  }, [sign.floating])

  return (
    <group ref={group} position={[...sign.position]} rotation={[0, sign.floating ? BILLBOARD_YAW.value : sign.rotationY, 0]}>
      <Text
        font={FIGTREE_600}
        fontSize={sign.size}
        color={SIGN_HEX[sign.colour]}
        anchorX="center"
        anchorY="middle"
        textAlign="center"
        lineHeight={LINE_HEIGHT}
        maxWidth={sign.maxWidth}
        whiteSpace="nowrap"
      >
        {sign.text}
      </Text>
    </group>
  )
}
