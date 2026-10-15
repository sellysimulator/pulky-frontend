import type { LucideIcon } from 'lucide-react'
import { useId, type ReactElement, type ReactNode } from 'react'

interface SectionCardProps {
  title: string
  icon?: LucideIcon
  meta?: ReactNode
  actions?: ReactNode
  tone?: 'default' | 'decision'
  density?: 'standard' | 'dense' | 'presentation'
  id?: string
  children: ReactNode
}

export default function SectionCard({
  title,
  icon: Icon,
  meta,
  actions,
  tone = 'default',
  density = 'standard',
  id,
  children,
}: SectionCardProps): ReactElement {
  const headingId = useId()
  const decision = tone === 'decision'
  const presentation = density === 'presentation'
  const dense = density === 'dense'
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={[
        'rounded-lg border bg-card',
        decision ? 'border-accent-line' : presentation ? 'border-border-strong' : 'border-border',
        presentation ? 'p-8' : 'shadow-card print:shadow-none',
      ].join(' ')}
    >
      <div className={['flex items-center gap-3', presentation ? 'pb-3' : dense ? 'px-4 pt-3 pb-3' : 'px-5 pt-4 pb-3'].join(' ')}>
        {Icon ? <Icon size={20} aria-hidden="true" className={decision ? 'text-accent' : 'text-ink-muted'} /> : null}
        <h2 id={headingId} className="text-lg">
          {title}
        </h2>
        {meta || actions ? (
          <div className="ml-auto flex items-center gap-3 text-sm text-ink-muted tabular-nums">
            {meta}
            {actions}
          </div>
        ) : null}
      </div>
      <div className={presentation ? '' : dense ? 'px-4 pb-4' : 'px-5 pb-5'}>{children}</div>
    </section>
  )
}
