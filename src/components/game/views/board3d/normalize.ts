import { Vector3, type Box3 } from 'three'

export type FitAxis = 'y' | 'z'

export interface ModelFit {
  axis: FitAxis
  size: number
}

export const MODEL_FIT: { truck: ModelFit; money: ModelFit; tree: ModelFit } = {
  truck: { axis: 'z', size: 5 },
  money: { axis: 'z', size: 0.5 },
  tree: { axis: 'y', size: 6 },
}

export interface Normalization {
  offset: Vector3
  scale: number
}

const MIN_EXTENT = 0.001

/** Centred on x and z, lowest point on the floor, one axis scaled to its target size in metres. */
export function normalizeTransform(bounds: Box3, fit: ModelFit): Normalization {
  const centre = bounds.getCenter(new Vector3())
  const size = bounds.getSize(new Vector3())
  return {
    offset: new Vector3(centre.x, bounds.min.y, centre.z),
    scale: fit.size / Math.max(size[fit.axis], MIN_EXTENT),
  }
}
