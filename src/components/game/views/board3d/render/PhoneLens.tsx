import { applyProps, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { FOV } from '../sceneLayout'

/** On a phone, widens the lens while the screen is upright: the pulquería's lens is set for a wide screen. */
export default function PhoneLens(): null {
  const camera = useThree((state) => state.camera)
  const upright = useThree((state) => state.size.height > state.size.width)

  useEffect(() => {
    applyProps(camera, { fov: upright ? FOV.upright : FOV.wide })
    camera.updateProjectionMatrix()
    return () => {
      applyProps(camera, { fov: FOV.wide })
      camera.updateProjectionMatrix()
    }
  }, [camera, upright])

  return null
}
