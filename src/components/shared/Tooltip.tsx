import { cloneElement, useCallback, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react'

const HOVER_DELAY_MS = 300

interface TooltipProps {
  content: ReactNode
  children: ReactElement<{ 'aria-describedby'?: string }>
}

/** Opens on hover after 300 ms and on focus at once; Escape closes (design.md §7.15). */
export default function Tooltip({ content, children }: TooltipProps): ReactElement {
  const id = useId()
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = useCallback((): void => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  useEffect(() => clear, [clear])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const hoverOpen = (): void => {
    clear()
    timer.current = setTimeout(() => setOpen(true), HOVER_DELAY_MS)
  }
  const close = (): void => {
    clear()
    setOpen(false)
  }
  const focusOpen = (): void => {
    clear()
    setOpen(true)
  }

  return (
    // The wrapper holds the pointer handlers, so the tooltip stays open while the pointer is over it (WCAG 1.4.13).
    <span className="relative inline-flex" onMouseEnter={hoverOpen} onMouseLeave={close} onFocus={focusOpen} onBlur={close}>
      {cloneElement(children, { 'aria-describedby': open ? id : children.props['aria-describedby'] })}
      {open ? (
        <span
          role="tooltip"
          id={id}
          className="absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-xs -translate-x-1/2 rounded-sm bg-ink px-2.5 py-1.5 text-sm text-on-ink shadow-raised"
        >
          {content}
        </span>
      ) : null}
    </span>
  )
}
