import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactElement } from 'react'
import type { BoardViewProps } from './Board2D'
import SceneLoading from './SceneLoading'
import { observeContextLoss } from './board3d/contextLoss'
import {
  applyLook,
  createMotionState,
  isTypingTarget,
  keyAction,
  moveKeyFor,
  type MotionState,
} from './board3d/playerMotion'
import PlayerController from './board3d/render/PlayerController'
import PulqueriaScene from './board3d/render/PulqueriaScene'
import SceneHud from './board3d/SceneHud'
import ScenePanels from './board3d/ScenePanels'
import { PANEL_TITLES, SPAWN, STATION_PANEL, type PanelId, type StationId } from './board3d/sceneLayout'
import { buildSceneModel } from './board3d/sceneModel'

/**
 * The walkable 3D pulquería. It takes the 2D board's props and nothing else, draws the scene model, and reaches the
 * server only through the decision form's `onSubmit`.
 */
export default function Board3D(props: BoardViewProps): ReactElement {
  const model = useMemo(() => buildSceneModel(props), [props])
  const [panel, setPanel] = useState<PanelId | null>(null)
  const [near, setNear] = useState<StationId | null>(null)
  const [ready, setReady] = useState(false)
  const [contextLost, setContextLost] = useState(false)
  const motion = useRef<MotionState>(createMotionState())
  const scene = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const drag = useRef<{ id: number; x: number; y: number } | null>(null)

  const markReady = useCallback(() => setReady(true), [])

  const open = (next: PanelId, button: HTMLElement | null): void => {
    opener.current = button
    motion.current.keys.clear()
    setPanel(next)
  }

  const close = (): void => {
    setPanel(null)
    ;(opener.current ?? scene.current)?.focus()
  }

  useEffect(() => {
    const host = scene.current
    if (!host) return
    return observeContextLoss(host, () => setContextLost(true))
  }, [])

  useEffect(() => {
    const held = motion.current.keys
    const onKeyDown = (event: KeyboardEvent): void => {
      const action = keyAction(
        {
          code: event.code,
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          repeat: event.repeat,
          typing: isTypingTarget(event.target),
        },
        { panel, near },
      )
      if (action === null) return
      if (action.type === 'move') {
        held.add(action.key)
        if (event.key.startsWith('Arrow')) event.preventDefault()
      } else if (action.type === 'open') {
        open(action.panel, null)
      } else {
        close()
      }
    }
    const onKeyUp = (event: KeyboardEvent): void => {
      const key = moveKeyFor(event.code)
      if (key !== null) held.delete(key)
    }
    const onBlur = (): void => held.clear()
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [panel, near])

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0 || panel !== null) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const current = drag.current
    if (current === null || current.id !== event.pointerId) return
    const look = applyLook(motion.current, event.clientX - current.x, event.clientY - current.y)
    motion.current.yaw = look.yaw
    motion.current.pitch = look.pitch
    current.x = event.clientX
    current.y = event.clientY
  }

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>): void => {
    if (drag.current?.id !== event.pointerId) return
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  if (contextLost) throw new Error('The WebGL context was lost.')

  return (
    <div className="fixed inset-x-0 top-14 bottom-0 overflow-hidden bg-canvas">
      <div
        ref={scene}
        role="img"
        aria-label={model.description}
        tabIndex={-1}
        className="absolute inset-0 cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <Canvas
          camera={{ fov: 70, near: 0.1, far: 150, position: [...SPAWN.position] }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          shadows={false}
          frameloop={panel === null ? 'always' : 'demand'}
          aria-hidden="true"
        >
          <PlayerController motion={motion} enabled={panel === null} stations={model.stations} onNearChange={setNear} />
          <Suspense fallback={null}>
            <PulqueriaScene model={model} onReady={markReady} />
          </Suspense>
        </Canvas>
      </div>
      <SceneHud
        view={props.view}
        participants={props.participants}
        awaiting={props.awaiting}
        openPanel={panel}
        onPanelButton={(id, button) => (panel === id ? close() : open(id, button))}
        prompt={panel === null && near !== null ? PANEL_TITLES[STATION_PANEL[near]] : null}
        drawer={<ScenePanels {...props} openPanel={panel} onClose={close} />}
      />
      {ready ? null : <SceneLoading />}
    </div>
  )
}
