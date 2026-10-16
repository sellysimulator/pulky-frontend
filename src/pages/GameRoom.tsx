import type { ComponentType, ReactElement } from 'react'
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { join, submitDay } from '../api/games'
import Board2D, { type BoardViewProps } from '../components/game/views/Board2D'
import GameOverPanel from '../components/game/GameOverPanel'
import LobbyPlayer from '../components/lobby/LobbyPlayer'
import AppHeader from '../components/shared/AppHeader'
import { PulqueriaChip } from '../components/shared/Badge'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import type { PageRoute } from '../routes/registry'
import { useGameStore } from '../store/gameStore'
import type { Decision, PublicConfig } from '../types/game'
import { getDisplayName, getSessionToken } from '../utils/storage'

// eslint-disable-next-line react-refresh/only-export-components
export const route: PageRoute = { path: '/game/:roomCode', guard: 'auth+backend' }

/** v2 adds '3D': lazy(() => import('../components/game/views/Board3D')) and nothing else (spec §13.11). */
// eslint-disable-next-line react-refresh/only-export-components
export const BOARD_VIEWS: { '2D': ComponentType<BoardViewProps> } = { '2D': Board2D }

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
  const View = BOARD_VIEWS['2D']

  let body: ReactElement
  if (unseatedLobby || state === 'lobby' || state === 'configuring') {
    body = <LobbyPlayer roomCode={code} />
  } else if ((state === 'running' || state === 'finished') && current && playerView !== null && config !== null) {
    const gameOver = state === 'finished'
    body = (
      <div className="flex flex-col gap-4">
        {gameOver ? <GameOverPanel roomCode={code} gamePublicId={gamePublicId} /> : null}
        <View
          view={playerView}
          ownHistory={ownHistory}
          publicHistory={publicHistory}
          lastRecord={ownHistory.length > 0 ? ownHistory[ownHistory.length - 1] : null}
          locked={playerView.has_submitted || gameOver}
          gameOver={gameOver}
          initialDecision={playerView.prefill_decision}
          config={config as PublicConfig}
          participants={participants}
          awaiting={awaiting}
          onSubmit={onSubmit}
        />
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
