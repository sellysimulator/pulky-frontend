import { useFrame, useThree } from '@react-three/fiber'
import type { Camera } from 'three'
import { useEffect, useRef, type MutableRefObject } from 'react'
import { HALL, type StationId } from '../sceneLayout'
import type { SceneStation } from '../sceneModel'
import { createChangeReporter, nearestStation, stepPosition, type MotionState } from '../playerMotion'

interface PlayerControllerProps {
  motion: MutableRefObject<MotionState>
  enabled: boolean
  stations: readonly SceneStation[]
  onNearChange(near: StationId | null): void
}

/** One frame of walking: the held keys move the player, and the camera follows the motion state. */
function walk(state: MotionState, camera: Camera, delta: number): void {
  if (state.keys.size > 0) {
    const next = stepPosition(state, state.keys, state.yaw, delta)
    state.x = next.x
    state.z = next.z
  }
  camera.position.set(state.x, HALL.eyeHeight, state.z)
  camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ')
}

/** Walks the camera. It sets no React state: the one report out is the change reporter's. */
export default function PlayerController({ motion, enabled, stations, onNearChange }: PlayerControllerProps): null {
  const camera = useThree((state) => state.camera)
  const report = useRef(createChangeReporter<StationId | null>(onNearChange, null))

  useEffect(() => {
    report.current = createChangeReporter<StationId | null>(onNearChange, null)
  }, [onNearChange])

  useEffect(() => {
    const { x, z, yaw, pitch } = motion.current
    camera.position.set(x, HALL.eyeHeight, z)
    camera.rotation.set(pitch, yaw, 0, 'YXZ')
  }, [camera, motion])

  useFrame((_, delta) => {
    if (!enabled) return
    walk(motion.current, camera, delta)
    report.current(nearestStation(motion.current, stations))
  })

  return null
}
