import { createContext, useContext, useEffect, useId, useMemo, useRef, useSyncExternalStore, type ReactElement, type ReactNode } from 'react'
import { getCrosshair, setCrosshair, subscribeCrosshair } from './chartSetup'

export interface CrosshairContextValue {
  group: string
  days: number
  /** The group's wrapper element, so a plot can tell whether focus stayed inside. */
  container: { current: HTMLElement | null }
}

const CrosshairContext = createContext<CrosshairContextValue | null>(null)

/** The enclosing group's id; null outside any group. */
// eslint-disable-next-line react-refresh/only-export-components
export function useCrosshairGroup(): string | null {
  return useContext(CrosshairContext)?.group ?? null
}

/** The full group context (id, days, wrapper); used by ChartBox. */
// eslint-disable-next-line react-refresh/only-export-components
export function useCrosshairContext(): CrosshairContextValue | null {
  return useContext(CrosshairContext)
}

/** design.md §9.5: charts that share a day axis read one day together. Index i is day i + 1. */
export default function CrosshairGroup({ days, children }: { days: number; children: ReactNode }): ReactElement {
  const group = useId()
  const container = useRef<HTMLDivElement | null>(null)
  const index = useSyncExternalStore(
    (listener) => subscribeCrosshair(group, listener),
    () => getCrosshair(group),
    () => null,
  )
  useEffect(() => () => setCrosshair(group, null), [group])
  const value = useMemo(() => ({ group, days, container }), [group, days])
  return (
    <CrosshairContext.Provider value={value}>
      <div ref={container}>{children}</div>
      <div className="sr-only" aria-live="polite">
        {index === null ? '' : `Day ${index + 1}`}
      </div>
    </CrosshairContext.Provider>
  )
}
