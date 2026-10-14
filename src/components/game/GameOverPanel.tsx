import type { ReactElement } from 'react'
import { Link } from 'react-router-dom'
import { resultsPath } from '../../utils/resultsPath'
import { InlineAlert } from '../shared/AlertContainer'

interface GameOverPanelProps {
  roomCode: string
  gamePublicId: string | null
}

/** Spec §13.8: the same link the host gets; nobody is redirected. */
export default function GameOverPanel({ roomCode, gamePublicId }: GameOverPanelProps): ReactElement {
  return (
    <InlineAlert tone="info" title="The game is over">
      <div className="flex flex-col items-start gap-3">
        <p>Your host will take everyone through the results.</p>
        <Link
          to={resultsPath(roomCode, gamePublicId)}
          className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-4 text-base font-semibold whitespace-nowrap text-on-accent transition-colors hover:bg-accent-hover"
        >
          See the results
        </Link>
      </div>
    </InlineAlert>
  )
}
