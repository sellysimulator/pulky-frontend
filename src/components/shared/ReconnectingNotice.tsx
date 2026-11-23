import type { ReactElement } from 'react'
import { useGameStore } from '../../store/gameStore'
import { InlineAlert } from './AlertContainer'

/**
 * "Reconnecting…" while the socket is down after having connected (spec §13.6). Fixed below the
 * header so it also shows over the 3D board; it never takes a click. Submit day waits meanwhile.
 */
export default function ReconnectingNotice(): ReactElement | null {
  const reconnecting = useGameStore((s) => s.reconnecting)
  if (!reconnecting) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]">
      <div className="shadow-raised">
        <InlineAlert tone="warning">Connection lost. Reconnecting…</InlineAlert>
      </div>
    </div>
  )
}
