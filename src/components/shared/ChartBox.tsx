import { ChartLine, Table } from 'lucide-react'
import { useState, type FocusEvent, type KeyboardEvent, type ReactElement, type ReactNode } from 'react'
import { getCrosshair, setCrosshair } from '../charts/chartSetup'
import { useCrosshairContext } from '../charts/CrosshairGroup'
import Button from './Button'
import ErrorBoundary from './ErrorBoundary'

interface ChartBoxProps {
  title: string
  caption?: string
  ariaLabel: string
  height: number
  /** A row under the title for choosing what the chart shows, such as a view toggle. */
  controls?: ReactNode
  legend?: ReactNode
  table: ReactNode
  children: ReactNode
}

/** Every chart lives in a ChartBox with a table view of the same values (design.md §7.18, §9.4). */
export default function ChartBox({ title, caption, ariaLabel, height, controls, legend, table, children }: ChartBoxProps): ReactElement {
  const [showTable, setShowTable] = useState(false)
  const plotHeight = `${height / 16}rem`
  const crosshair = useCrosshairContext()

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!crosshair) return
    const { group, days } = crosshair
    const last = days - 1
    const current = getCrosshair(group)
    let next: number | null
    switch (event.key) {
      case 'ArrowRight':
        next = current === null ? last : Math.min(last, current + 1)
        break
      case 'ArrowLeft':
        next = current === null ? last : Math.max(0, current - 1)
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = last
        break
      case 'Escape':
        next = null
        break
      default:
        return
    }
    event.preventDefault()
    setCrosshair(group, next)
  }
  const onFocus = (): void => {
    if (crosshair && getCrosshair(crosshair.group) === null) setCrosshair(crosshair.group, crosshair.days - 1)
  }
  const onBlur = (event: FocusEvent<HTMLDivElement>): void => {
    if (!crosshair) return
    const to = event.relatedTarget
    if (!(to instanceof Node) || !crosshair.container.current?.contains(to)) setCrosshair(crosshair.group, null)
  }
  const groupProps = crosshair
    ? { tabIndex: 0, onKeyDown, onFocus, onBlur }
    : {}
  return (
    <figure className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <figcaption className="flex items-center gap-3">
        <span className="flex min-w-0 flex-col">
          <span className="text-base font-semibold">{title}</span>
          {caption ? <span className="text-xs text-ink-muted">{caption}</span> : null}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto print:hidden"
          icon={showTable ? ChartLine : Table}
          aria-pressed={showTable}
          onClick={() => setShowTable((v) => !v)}
        >
          {showTable ? 'Show chart' : 'Show table'}
        </Button>
      </figcaption>
      {controls ? <div className="print:hidden">{controls}</div> : null}
      {legend ? <div>{legend}</div> : null}
      {showTable ? (
        <div className="overflow-auto" style={{ maxHeight: plotHeight }}>
          {table}
        </div>
      ) : (
        <div
          role="img"
          aria-label={ariaLabel}
          className={crosshair ? 'relative focus-visible:ring-2 focus-visible:ring-ring' : 'relative'}
          style={{ height: plotHeight }}
          {...groupProps}
        >
          <ErrorBoundary
            fallback={
              <div className="grid place-items-center" style={{ height: plotHeight }}>
                <p className="text-sm text-ink-muted text-center">
                  The chart could not be drawn here. The same figures are in the table.
                </p>
              </div>
            }
          >
            {children}
          </ErrorBoundary>
        </div>
      )}
    </figure>
  )
}
