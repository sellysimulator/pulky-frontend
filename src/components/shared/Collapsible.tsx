import { ChevronRight, type LucideIcon } from 'lucide-react'
import type { MouseEvent, ReactElement, ReactNode } from 'react'

interface CollapsibleProps {
  variant: 'card' | 'inline'
  summary: ReactNode
  icon?: LucideIcon
  open: boolean
  onOpenChange(open: boolean): void
  children: ReactNode
}

/** Native details/summary; the caller owns the open state (design.md §7.7). */
export default function Collapsible({
  variant,
  summary,
  icon: Icon,
  open,
  onOpenChange,
  children,
}: CollapsibleProps): ReactElement {
  const toggle = (e: MouseEvent<HTMLElement>): void => {
    e.preventDefault()
    onOpenChange(!open)
  }
  const chevron = (size: number): ReactElement => (
    <ChevronRight size={size} aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-90" />
  )

  if (variant === 'card') {
    return (
      <details open={open} className="group rounded-lg border border-border bg-card shadow-card print:shadow-none">
        <summary
          onClick={toggle}
          className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-5 text-lg font-semibold hover:bg-inset [&::-webkit-details-marker]:hidden"
        >
          {chevron(20)}
          {Icon ? <Icon size={20} aria-hidden="true" className="text-ink-muted" /> : null}
          {summary}
        </summary>
        <div className="border-t border-border px-5 py-5">{children}</div>
      </details>
    )
  }

  return (
    <details open={open} className="group">
      <summary
        onClick={toggle}
        className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-hover [&::-webkit-details-marker]:hidden"
      >
        {chevron(16)}
        {Icon ? <Icon size={16} aria-hidden="true" /> : null}
        {summary}
      </summary>
      <div className="mt-2 rounded-md border border-border bg-inset p-4">{children}</div>
    </details>
  )
}
