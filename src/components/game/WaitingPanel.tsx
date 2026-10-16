import { CircleDashed } from 'lucide-react'
import type { ReactElement } from 'react'
import type { Participant } from '../../types/game'

interface WaitingPanelProps {
  awaiting: string[]
  participants: Participant[]
}

/** After submitting: who the day is still waiting for, announced as one polite status region (design.md §11.6). */
export default function WaitingPanel({ awaiting, participants }: WaitingPanelProps): ReactElement {
  const names = awaiting.map((alias) => participants.find((p) => p.alias === alias)?.display_name ?? alias)
  const text = names.length > 0 ? `Day submitted. Waiting for ${names.join(', ')}.` : 'Everyone is in. Closing the day…'
  return (
    <div role="status" className="flex items-center gap-2 border-t border-border pt-3 text-base text-ink-muted">
      <CircleDashed size={18} aria-hidden="true" className="shrink-0" />
      <span>{text}</span>
    </div>
  )
}
