import { CircleCheck, CircleX, Info, TriangleAlert, X, type LucideIcon } from 'lucide-react'
import { useEffect, type ReactElement, type ReactNode } from 'react'
import { useGameStore } from '../../store/gameStore'

const AUTO_DISMISS_MS = 5000

type Status = 'success' | 'warning' | 'danger' | 'info'

const ICONS: Record<Status, LucideIcon> = {
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleX,
  info: Info,
}
const MARK: Record<Status, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
}
const INLINE: Record<Status, string> = {
  success: 'border-success-line bg-success-subtle text-success-ink',
  warning: 'border-warning-line bg-warning-subtle text-warning-ink',
  danger: 'border-danger-line bg-danger-subtle text-danger-ink',
  info: 'border-info-line bg-info-subtle text-info-ink',
}
const TOAST_BORDER: Record<Status, string> = {
  success: 'border-success-line',
  warning: 'border-warning-line',
  danger: 'border-danger-line',
  info: 'border-info-line',
}
const KIND_STATUS: Record<'info' | 'success' | 'error', Status> = { info: 'info', success: 'success', error: 'danger' }

/** Inline alert: icon, optional title, body in the status ink (design.md §7.13). */
export function InlineAlert({
  tone,
  title,
  children,
}: {
  tone: Status
  title?: string
  children: ReactNode
}): ReactElement {
  const Icon = ICONS[tone]
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={['flex gap-3 rounded-md border px-4 py-3', INLINE[tone]].join(' ')}>
      <Icon size={20} aria-hidden="true" className={['mt-0.5 shrink-0', MARK[tone]].join(' ')} />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div>{children}</div>
      </div>
    </div>
  )
}

function Toast({ id, kind, message }: { id: string; kind: 'info' | 'success' | 'error'; message: string }): ReactElement {
  const dismissAlert = useGameStore((s) => s.dismissAlert)
  const status = KIND_STATUS[kind]
  const Icon = ICONS[status]

  useEffect(() => {
    if (kind === 'error') return
    const timer = setTimeout(() => dismissAlert(id), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [id, kind, dismissAlert])

  return (
    <div className={['pointer-events-auto flex gap-3 rounded-md border bg-card px-4 py-3 shadow-raised', TOAST_BORDER[status]].join(' ')}>
      <Icon size={20} aria-hidden="true" className={['mt-0.5 shrink-0', MARK[status]].join(' ')} />
      <p className="min-w-0 flex-1 text-ink">{message}</p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => dismissAlert(id)}
        className="relative grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-ink-muted transition-colors after:absolute after:-inset-1.5 hover:bg-muted hover:text-ink"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  )
}

/** Toasts for the store's alerts. Never takes focus; announced politely. */
export default function AlertContainer(): ReactElement {
  const alerts = useGameStore((s) => s.alerts)
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed top-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {alerts.map((a) => (
        <Toast key={a.id} id={a.id} kind={a.kind} message={a.message} />
      ))}
    </div>
  )
}
