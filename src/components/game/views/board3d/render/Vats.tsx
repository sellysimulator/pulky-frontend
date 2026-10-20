import { useLayoutEffect, useRef, type ReactElement } from 'react'
import type { InstancedMesh } from 'three'
import { RISK_HEX } from '../scenePalette'
import { VAT, VAT_SLOTS } from '../sceneLayout'
import type { SceneVat } from '../sceneModel'
import { colourInstance, finishPool, GEOMETRY, placeInstance } from './geometry'
import { MATERIALS } from './materials'

/** One open vat per cellar lot: body, risk-coloured hoops, the pulque (open) or the cloth (conserved). */
export default function Vats({ vats }: { vats: readonly SceneVat[] }): ReactElement {
  const bodies = useRef<InstancedMesh>(null)
  const hoops = useRef<InstancedMesh>(null)
  const pulque = useRef<InstancedMesh>(null)
  const covers = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const open = vats.filter((vat) => !vat.conserved)
    const covered = vats.filter((vat) => vat.conserved)
    if (bodies.current && hoops.current) {
      vats.forEach((vat, i) => {
        placeInstance(bodies.current as InstancedMesh, i, vat.position)
        placeInstance(hoops.current as InstancedMesh, i, vat.position)
        colourInstance(hoops.current as InstancedMesh, i, RISK_HEX[vat.risk])
      })
      finishPool(bodies.current, vats.length)
      finishPool(hoops.current, vats.length)
    }
    if (pulque.current) {
      open.forEach((vat, i) => {
        const y = VAT.floorY + vat.level * (VAT.liquidTopY - VAT.floorY)
        placeInstance(pulque.current as InstancedMesh, i, [vat.position[0], y, vat.position[2]])
      })
      finishPool(pulque.current, open.length)
    }
    if (covers.current) {
      covered.forEach((vat, i) => placeInstance(covers.current as InstancedMesh, i, vat.position))
      finishPool(covers.current, covered.length)
    }
  }, [vats])

  return (
    <>
      <instancedMesh ref={bodies} args={[GEOMETRY.vatBody, MATERIALS.vat, VAT_SLOTS]} />
      <instancedMesh ref={hoops} args={[GEOMETRY.vatHoops, MATERIALS.hoops, VAT_SLOTS]} />
      <instancedMesh ref={pulque} args={[GEOMETRY.pulque, MATERIALS.pulque, VAT_SLOTS]} />
      <instancedMesh ref={covers} args={[GEOMETRY.cover, MATERIALS.cover, VAT_SLOTS]} />
    </>
  )
}
