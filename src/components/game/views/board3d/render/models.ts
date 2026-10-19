import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import { Color, type BufferAttribute, type Material, type Mesh, type MeshStandardMaterial, type Object3D } from 'three'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { MODEL_FIT, normalizeTransform, type ModelFit } from '../normalize'

export const MODEL_URL = { truck: '/3dmodels/truck.glb', money: '/3dmodels/money.glb', tree: '/3dmodels/tree.glb' } as const

// Module scope: the downloads start with the chunk.
useGLTF.preload([MODEL_URL.truck, MODEL_URL.money, MODEL_URL.tree])

function meshesOf(root: Object3D): Mesh[] {
  root.updateMatrixWorld(true)
  const meshes: Mesh[] = []
  root.traverse((object) => {
    if ((object as Mesh).isMesh) meshes.push(object as Mesh)
  })
  return meshes
}

function normalised(geometry: THREE.BufferGeometry, fit: ModelFit): THREE.BufferGeometry {
  geometry.computeBoundingBox()
  const { offset, scale } = normalizeTransform(geometry.boundingBox as THREE.Box3, fit)
  geometry.translate(-offset.x, -offset.y, -offset.z)
  geometry.scale(scale, scale, scale)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

/**
 * [HARD-WON] Every mesh in world space, merged into one geometry with its material's colour on every vertex: one draw
 * call where the file has one per mesh. Material colours are linear, as vertex colours are read.
 */
export function bakeVertexColours(root: Object3D, fit: ModelFit): THREE.BufferGeometry {
  const parts = meshesOf(root).map((mesh) => {
    if (Array.isArray(mesh.material)) throw new Error(`bakeVertexColours: ${mesh.name} has several materials`)
    const part = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
    part.applyMatrix4(mesh.matrixWorld)
    for (const name of Object.keys(part.attributes)) if (name !== 'position' && name !== 'normal') part.deleteAttribute(name)
    part.morphAttributes = {}
    if (!part.getAttribute('normal')) part.computeVertexNormals()
    const colour = (mesh.material as MeshStandardMaterial).color ?? new Color(1, 1, 1)
    const count = part.getAttribute('position').count
    const colours = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) colours.set([colour.r, colour.g, colour.b], i * 3)
    part.setAttribute('color', new THREE.BufferAttribute(colours, 3) as BufferAttribute)
    return part
  })
  const merged = mergeGeometries(parts)
  for (const part of parts) part.dispose()
  if (!merged) throw new Error('bakeVertexColours: the parts could not be merged')
  return normalised(merged, fit)
}

/** A one-mesh model keeps its own material: money.glb's texture is the model, so it is never tinted. */
export function bakeTextured(root: Object3D, fit: ModelFit): { geometry: THREE.BufferGeometry; material: Material } {
  const meshes = meshesOf(root)
  if (meshes.length !== 1 || Array.isArray(meshes[0].material)) throw new Error('bakeTextured: expects one mesh with one material')
  const geometry = meshes[0].geometry.clone().applyMatrix4(meshes[0].matrixWorld)
  return { geometry: normalised(geometry, fit), material: meshes[0].material as Material }
}

export function useSceneModels() {
  const [truck, money, tree] = useGLTF([MODEL_URL.truck, MODEL_URL.money, MODEL_URL.tree])
  return useMemo(
    () => ({
      truck: bakeVertexColours(truck.scene, MODEL_FIT.truck),
      money: bakeTextured(money.scene, MODEL_FIT.money),
      tree: bakeVertexColours(tree.scene, MODEL_FIT.tree),
    }),
    [truck.scene, money.scene, tree.scene],
  )
}
