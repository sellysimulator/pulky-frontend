import { BookOpen } from 'lucide-react'
import type { ReactElement } from 'react'
import { Link } from 'react-router-dom'

export const HOST_MANUAL_PATH = '/host-manual'
export const PLAYER_MANUAL_PATH = '/player-manual'

const MANUAL_LINK = 'inline-flex min-h-11 items-center gap-2 font-semibold text-accent underline-offset-2 hover:text-accent-hover hover:underline'

/** Both manuals, for the screens before a room: nothing is open yet, so they open in place. */
export function ManualLinks(): ReactElement {
  return (
    <nav aria-label="Manuals" className="flex flex-wrap justify-center gap-x-6 text-sm">
      <Link to={PLAYER_MANUAL_PATH} className={MANUAL_LINK}>
        <BookOpen size={16} aria-hidden="true" />
        Player manual
      </Link>
      <Link to={HOST_MANUAL_PATH} className={MANUAL_LINK}>
        <BookOpen size={16} aria-hidden="true" />
        Host manual
      </Link>
    </nav>
  )
}

/**
 * The manual link in a room's header. It opens a new tab, so reading the
 * manual never unmounts the room: a decision draft, the 3D walk and the host's
 * unsent settings stay as they were (spec §13.15).
 */
export default function ManualLink({ to, label }: { to: string; label: string }): ReactElement {
  return (
    <a
      href={to}
      target="_blank"
      rel="noopener"
      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md px-2 text-sm font-medium text-ink-muted transition-colors hover:bg-muted hover:text-ink"
    >
      <BookOpen size={16} aria-hidden="true" />
      <span className="sr-only md:not-sr-only">{label}</span>
    </a>
  )
}
