import type { ReactElement } from 'react'
import Button from '../shared/Button'
import { InlineAlert } from '../shared/AlertContainer'

interface StartControlProps {
  canStart: boolean
  startBlockedReason: string | null
  onStart(): void
  pending?: boolean
}

/** Never decides eligibility: `canStart` is the server's value (spec §0.5 invariant 7). */
export default function StartControl({ canStart, startBlockedReason, onStart, pending = false }: StartControlProps): ReactElement {
  return (
    <div className="flex flex-col gap-3">
      {!canStart && startBlockedReason !== null ? <InlineAlert tone="info">{startBlockedReason}</InlineAlert> : null}
      <Button variant="primary" size="lg" className="w-full" disabled={!canStart} loading={pending} onClick={onStart}>
        Start game
      </Button>
    </div>
  )
}
