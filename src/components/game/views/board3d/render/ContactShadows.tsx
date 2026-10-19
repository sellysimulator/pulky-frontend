import { useLayoutEffect, useRef, type ReactElement } from 'react'
import type { InstancedMesh } from 'three'
import type { SceneContact } from '../sceneModel'
import { finishPool, GEOMETRY, placeInstance } from './geometry'
import { MATERIALS } from './materials'

// The scene model lists the counter, up to six vats, the bin and up to four trucks.
const CONTACT_CAPACITY = 16

/** Flat dark ellipses on the floor under objects: the scene has no shadow maps. */
export default function ContactShadows({ contacts }: { contacts: readonly SceneContact[] }): ReactElement {
  const mesh = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const pool = mesh.current
    if (!pool) return
    contacts.forEach((contact, i) => placeInstance(pool, i, contact.position, 0, [contact.sizeX, 1, contact.sizeZ]))
    finishPool(pool, contacts.length)
  }, [contacts])

  return <instancedMesh ref={mesh} args={[GEOMETRY.contact, MATERIALS.contact, CONTACT_CAPACITY]} />
}
