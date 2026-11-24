import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { enterRoom, joinWaiting } from '../api/games'
import ConfigPanel from '../components/config/ConfigPanel'
import HostConsole from '../components/host/HostConsole'
import PresentationMode from '../components/host/PresentationMode'
import { selectHostHistories, selectPresentationData } from '../components/host/presentationData'
import LobbyHost from '../components/lobby/LobbyHost'
import ManualLink, { HOST_MANUAL_PATH } from '../components/manual/ManualLink'
import AppHeader from '../components/shared/AppHeader'
import { InlineAlert } from '../components/shared/AlertContainer'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import ReconnectingNotice from '../components/shared/ReconnectingNotice'
import type { PageRoute } from '../routes/registry'
import { useGameStore } from '../store/gameStore'
import { getHostSecret } from '../utils/storage'

export const route: PageRoute = { path: '/host/:roomCode', guard: 'auth+backend' }

export default function HostRoom(): ReactElement {
  const { roomCode: rawCode = '' } = useParams()
  const code = rawCode.toUpperCase()

  const storeRoom = useGameStore((s) => s.roomCode)
  const roomState = useGameStore((s) => s.roomState)
  const hostClaimed = useGameStore((s) => s.hostClaimed)
  const joinError = useGameStore((s) => s.joinError)
  const hostView = useGameStore((s) => s.hostView)
  const configLocked = useGameStore((s) => s.configLocked)
  const gamePublicId = useGameStore((s) => s.gamePublicId)
  const histories = useGameStore(useShallow(selectHostHistories))
  const publicHistory = useGameStore((s) => s.publicHistory)
  const brief = useGameStore((s) => s.brief)
  const [presenting, setPresenting] = useState(false)

  useEffect(() => {
    if (enterRoom(code, true)) return // reconnecting: the `connect` handler claims it
    joinWaiting(code, getHostSecret(code))
  }, [code])

  const current = storeRoom === code
  const hostSecret = getHostSecret(code)
  const claimed = current && hostClaimed
  const failure = current ? joinError : null
  const state = current ? roomState : null

  // A memo, not `useShallow`: the copy nests new objects on every call, so a store selector would never settle.
  const presentation = useMemo(
    () => (presenting && current ? selectPresentationData({ hostView, brief, publicHistory }) : null),
    [presenting, current, hostView, brief, publicHistory],
  )

  let body: ReactElement
  if (!claimed && failure === null) {
    body = <LoadingSpinner label="Opening the room" />
  } else if (!claimed && failure !== null) {
    body = (
      <InlineAlert tone="danger">
        <p>{failure}</p>
        <Link to="/home" className="font-semibold underline">
          Back to home
        </Link>
      </InlineAlert>
    )
  } else if ((state === 'running' || state === 'finished') && hostView !== null) {
    body = (
      <HostConsole
        hostView={hostView}
        histories={histories}
        roomCode={code}
        hostSecret={hostSecret}
        finished={state === 'finished'}
        gamePublicId={gamePublicId}
        onPresent={() => setPresenting(true)}
      />
    )
  } else if (state === 'lobby' || state === 'configuring') {
    body = (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="order-last min-w-0 xl:order-none">
          <ConfigPanel roomCode={code} hostSecret={hostSecret} locked={configLocked} />
        </div>
        <aside className="order-first xl:sticky xl:top-6 xl:order-none xl:self-start">
          <LobbyHost roomCode={code} hostSecret={hostSecret} />
        </aside>
      </div>
    )
  } else {
    body = <LoadingSpinner label="Opening the room" />
  }

  const context = presenting ? null : (
    <>
      <span className="font-mono text-sm tracking-widest text-ink-muted">{code}</span>
      <ManualLink to={HOST_MANUAL_PATH} label="Host manual" />
    </>
  )
  const wide = (state === 'running' || state === 'finished') && hostView !== null ? 'max-w-console' : 'max-w-config'

  return (
    <>
      <AppHeader context={context} />
      <ReconnectingNotice />
      <main id="main" className={['mx-auto w-full px-4 py-6 md:px-6', wide].join(' ')}>
        {body}
      </main>
      {presentation !== null ? <PresentationMode data={presentation} onExit={() => setPresenting(false)} /> : null}
    </>
  )
}
