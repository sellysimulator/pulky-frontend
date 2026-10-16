import { useState, type ReactElement } from 'react'
import type { UserMe } from '../../types/game'

function Avatar({ me }: { me: UserMe }): ReactElement {
  const [failed, setFailed] = useState(false)
  const initial = (me.display_name ?? me.email ?? '?').trim().charAt(0).toUpperCase() || '?'
  if (me.photo_url && !failed) {
    return (
      <img
        src={me.photo_url}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="size-14 rounded-full object-cover"
      />
    )
  }
  return (
    <span className="grid size-14 place-items-center rounded-full bg-accent-subtle font-display text-2xl font-bold text-accent-hover">
      {initial}
    </span>
  )
}

/** Design.md §8.9: avatar (Google photos answer 429 to referrers, spec §13.6), name and email. */
export default function ProfileHeader({ me }: { me: UserMe }): ReactElement {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-5 shadow-card">
      <Avatar key={me.photo_url ?? ''} me={me} />
      <div className="min-w-0">
        <h1 className="truncate text-2xl">{me.display_name ?? me.email}</h1>
        {me.email ? <p className="truncate text-ink-muted">{me.email}</p> : null}
      </div>
    </div>
  )
}
