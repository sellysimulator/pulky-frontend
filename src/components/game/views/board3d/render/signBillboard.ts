import type { Group } from 'three'

// Module scope in its own .ts file: a component module loses mutable state on fast refresh.

/** The groups of the floating signs, all turned to the one shared yaw. */
export const BILLBOARD_GROUPS = new Set<Group>()

/** The yaw every floating sign (and its plate) currently faces. */
export const BILLBOARD_YAW = { value: 0 }
