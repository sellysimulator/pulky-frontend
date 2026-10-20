import type { ComponentType, ReactElement } from 'react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { join, submitDay } from '../api/games'
import Board2D, { type BoardViewProps } from '../components/game/views/Board2D'
import GameOverPanel from '../components/game/GameOverPanel'
import BoardViewToggle from '../components/game/views/BoardViewToggle'
import { resolveBoardView, useBoardViewSupport, type BoardView } from '../components/game/views/boardView'
import SceneLoading from '../components/game/views/SceneLoading'
import LobbyPlayer from '../components/lobby/LobbyPlayer'
import { InlineAlert } from '../components/shared/AlertContainer'
import AppHeader from '../components/shared/AppHeader'
import { PulqueriaChip } from '../components/shared/Badge'
import ErrorBoundary from '../components/shared/ErrorBoundary'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import type { PageRoute } from '../routes/registry'
import { useGameStore } from '../store/gameStore'
import type { Decision, PublicConfig } from '../types/game'
import { getBoardView, getDisplayName, getSessionToken, setBoardView } from '../utils/storage'

// eslint-disable-next-line react-refresh/only-export-components
export const route: PageRoute = { path: '/game/:roomCode', guard: 'auth+backend' }

const Board3D = lazy(() => import('../components/game/views/Board3D'))

/** The two board views, one props contract (spec §13.11.1); the 3D chunk is fetched only when it is shown. */
// eslint-disable-next-line react-refresh/only-export-components
export const BOARD_VIEWS: Record<BoardView, ComponentType<BoardViewProps>> = { '2D': Board2D, '3D': Board3D }

export default function GameRoom(): ReactElement {
  const { roomCode: rawCode = '' } = useParams()
  const code = rawCode.toUpperCase()

  const storeRoom = useGameStore((s) => s.roomCode)
  const myAlias = useGameStore((s) => s.myAlias)
  const roomState = useGameStore((s) => s.roomState)
  const joinError = useGameStore((s) => s.joinError)
  const playerView = useGameStore((s) => s.playerView)
  const config = useGameStore((s) => s.config)
  const participants = useGameStore((s) => s.participants)
  const awaiting = useGameStore((s) => s.awaiting)
  const ownHistory = useGameStore((s) => s.ownHistory)
  const publicHistory = useGameStore((s) => s.publicHistory)
  const gamePublicId = useGameStore((s) => s.gamePublicId)
  const setRoom = useGameStore((s) => s.setRoom)

  const [choice, setChoice] = useState<BoardView>(() => resolveBoardView(getBoardView()))
  const [fellBack, setFellBack] = useState(false)
  const support = useBoardViewSupport()
  // Only storage and component state: no socket event, no request, and the join effect does not depend on it.
  const choose = (next: BoardView): void => {
    setBoardView(next)
    setChoice(next)
    setFellBack(false)
  }

  useEffect(() => {
    setRoom(code, false)
    const token = getSessionToken(code)
    if (token !== null) join(code, getDisplayName(), token)
  }, [code, setRoom])

  // Server state belongs to the room this page is for; anything else is a leftover from another room.
  const current = storeRoom === code
  const seated = current && myAlias !== null
  const token = getSessionToken(code)
  const state = current ? roomState : null
  const unseatedLobby = !seated && (token === null || (current && joinError !== null))

  const onSubmit = (decision: Decision): void => submitDay(code, decision)

  let body: ReactElement
  if (unseatedLobby || state === 'lobby' || state === 'configuring') {
    body = <LobbyPlayer roomCode={code} />
  } else if ((state === 'running' || state === 'finished') && current && playerView !== null && config !== null) {
    const gameOver = state === 'finished'
    const shown: BoardView = choice === '3D' && support.ok && !gameOver ? '3D' : '2D'
    const View = BOARD_VIEWS[shown]
    const boardProps: BoardViewProps = {
      view: playerView,
      ownHistory,
      publicHistory,
      lastRecord: ownHistory.length > 0 ? ownHistory[ownHistory.length - 1] : null,
      locked: playerView.has_submitted || gameOver,
      gameOver,
      initialDecision: playerView.prefill_decision,
      config: config as PublicConfig,
      participants,
      awaiting,
      onSubmit,
    }
    body = (
      <div className="flex flex-col gap-4">
        {gameOver ? <GameOverPanel gamePublicId={gamePublicId} /> : null}
        {fellBack ? <InlineAlert tone="info">The 3D view stopped working, so the board switched to 2D.</InlineAlert> : null}
        <ErrorBoundary
          key={shown}
          fallback={<Board2D {...boardProps} />}
          onError={() => {
            setBoardView('2D')
            setChoice('2D')
            setFellBack(true)
          }}
        >
          <Suspense fallback={<SceneLoading />}>
            <View {...boardProps} />
          </Suspense>
        </ErrorBoundary>
      </div>
    )
  } else {
    body = <LoadingSpinner label="Joining the room" />
  }

  const name = participants.find((p) => p.alias === myAlias)?.display_name ?? playerView?.display_name ?? null
  const context = (
    <>
      <span className="font-mono text-sm tracking-widest text-ink-muted">{code}</span>
      {seated && myAlias !== null && name !== null ? <PulqueriaChip alias={myAlias} displayName={name} /> : null}
      {state === 'running' && seated ? <BoardViewToggle value={choice} support={support} onChange={choose} /> : null}
    </>
  )

  return (
    <>
      <AppHeader context={context} />
      <main id="main" className="mx-auto w-full max-w-player px-4 py-6 md:px-6">
        {body}
      </main>
    </>
  )
}
