import { useThree } from '@react-three/fiber'
import { useEffect, type ReactElement } from 'react'
import type { SceneModel } from '../sceneModel'
import { SCENE_HEX } from '../scenePalette'
import Counter from './Counter'
import ContactShadows from './ContactShadows'
import Decor from './Decor'
import { HEMISPHERE_INTENSITY } from './materials'
import { useSceneModels } from './models'
import MoneyStacks from './MoneyStacks'
import SalvageBin from './SalvageBin'
import SceneShell from './SceneShell'
import SceneSign from './SceneSign'
import SignPlates from './SignPlates'
import Trucks from './Trucks'
import Vats from './Vats'
import WallBoards from './WallBoards'

interface PulqueriaSceneProps {
  model: SceneModel
  onReady(): void
}

/** The whole room, drawn from the scene model and nothing else. The only light of the scene is made here. */
export default function PulqueriaScene({ model, onReady }: PulqueriaSceneProps): ReactElement {
  const models = useSceneModels()
  const invalidate = useThree((state) => state.invalidate)

  useEffect(() => {
    onReady()
  }, [onReady])

  // The canvas may be on demand (a panel is open): a new day's model asks for its redraw.
  useEffect(() => {
    invalidate()
  }, [model, invalidate])

  useEffect(
    () => () => {
      models.truck.dispose()
      models.money.geometry.dispose()
      models.tree.dispose()
    },
    [models],
  )

  return (
    <>
      <color attach="background" args={[SCENE_HEX.sky]} />
      <hemisphereLight args={[SCENE_HEX.hemisphereSky, SCENE_HEX.hemisphereGround, HEMISPHERE_INTENSITY]} />
      <SceneShell />
      <Counter />
      <WallBoards />
      <Vats vats={model.vats} />
      <SalvageBin />
      <MoneyStacks money={model.money} model={models.money} />
      <Trucks trucks={model.trucks} geometry={models.truck} />
      <Decor tree={models.tree} />
      <ContactShadows contacts={model.contacts} />
      {model.signs.map((sign) => (
        <SceneSign key={sign.id} sign={sign} />
      ))}
      <SignPlates signs={model.signs} />
    </>
  )
}
