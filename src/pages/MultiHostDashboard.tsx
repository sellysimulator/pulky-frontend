import { ArrowLeft, Play, Plus } from 'lucide-react'
import { useEffect, useState, type ReactElement } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { startGame } from '../api/games'
import { socket } from '../api/socket'
import GameCard from '../components/multihost/GameCard'
import { hostedRooms, readyRooms } from '../components/multihost/multihost'
import { useRoomsSummary } from '../components/multihost/useRoomsSummary'
import AppHeader from '../components/shared/AppHeader'
import { InlineAlert } from '../components/shared/AlertContainer'
import Button from '../components/shared/Button'
import type { PageRoute } from '../routes/registry'
import { useGameStore } from '../store/gameStore'
import { clearHostBatch, getHostBatch } from '../utils/storage'

// eslint-disable-next-line react-refresh/only-export-components
export const route: PageRoute = { path: '/multihost', guard: 'auth+backend' }

/** How long after "Start all" the dashboard asks for fresh status, so the server has
 * handled the `start_game` emits first. */
const REFRESH_AFTER_START_MS = 1000

/**
 * /multihost: every game of the batch this tab created, as a grid of cards.
 *
 * It sits one layer above the host screen and joins no room: seats and status come
 * from `POST /rooms/summary`, and each game's host screen opens in its own tab
 * (`openHostScreen`). "Start all ready games" sends the ordinary `start_game` with each
 * room's secret, which is all the server checks (spec §11.3).
 */
export default function MultiHostDashboard(): ReactElement {
  const navigate = useNavigate()
  // Read once: the batch changes only on /multihost/new, which remounts this page.
  const [rooms] = useState(() => hostedRooms(getHostBatch() ?? []))
  const { summaries, error, refresh } = useRoomsSummary(rooms)

  // This tab may have hosted or joined a room before. Forget it, so the socket's
  // `connect` handler does not re-join it, and reconnect, so the server drops this
  // socket from that room's channel and its broadcasts stop landing here.
  useEffect(() => {
    if (useGameStore.getState().roomCode === null) return
    useGameStore.getState().reset()
    if (socket.active) socket.disconnect().connect()
  }, [])

  if (rooms.length === 0) return <Navigate to="/multihost/new" replace />

  const ready = readyRooms(rooms, summaries)

  const startAll = (): void => {
    for (const { room_code, host_secret } of ready) startGame(room_code, host_secret)
    window.setTimeout(refresh, REFRESH_AFTER_START_MS)
  }

  const newBatch = (): void => {
    clearHostBatch()
    navigate('/multihost/new')
  }

  return (
    <>
      <AppHeader />
      <main id="main" className="mx-auto flex w-full max-w-console flex-col gap-6 px-4 py-6 md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <Link to="/home" className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
              <ArrowLeft size={16} aria-hidden="true" />
              Home
            </Link>
            <h1 className="text-2xl">Your games</h1>
            <p className="text-base text-ink-muted">
              Share each invite link or QR code with one group. Seats refresh every few seconds.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={Play} disabled={ready.length === 0} onClick={startAll}>
              {`Start all ready games (${ready.length})`}
            </Button>
            <Button icon={Plus} onClick={newBatch}>
              New batch
            </Button>
          </div>
        </div>
        {error !== null ? <InlineAlert tone="danger">{error}</InlineAlert> : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map(({ room_code }, index) => (
            <GameCard key={room_code} index={index} roomCode={room_code} summary={summaries[room_code]} />
          ))}
        </div>
      </main>
    </>
  )
}
