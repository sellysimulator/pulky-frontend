import type { LucideIcon } from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  body: string
  action?: ReactNode
}

export default function EmptyState({ icon: Icon, title, body, action }: EmptyStateProps): ReactElement {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-muted">
        <Icon size={32} aria-hidden="true" className="text-ink-subtle" />
      </span>
      <p className="text-base font-semibold">{title}</p>
      <p className="text-sm text-ink-muted">{body}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}
