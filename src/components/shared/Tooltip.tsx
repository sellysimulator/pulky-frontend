import { cloneElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const HOVER_DELAY_MS = 300
const GAP_PX = 8
const EDGE_PX = 8

interface TooltipProps {
  content: ReactNode
  children: ReactElement<{ 'aria-describedby'?: string }>
}

/**
 * Opens on hover after 300 ms and on focus at once; Escape closes (design.md §7.15). The tip is portalled and
 * fixed, so a scrolling table never clips it, and it is kept inside the viewport.
 */
export default function Tooltip({ content, children }: TooltipProps): ReactElement {
  const id = useId()
  const [host, setHost] = useState<Element | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const anchor = useRef<HTMLSpanElement>(null)
  const tip = useRef<HTMLSpanElement>(null)
  const open = host !== null

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
      if (e.key === 'Escape') setHost(null)
    }
    const onScroll = (): void => setHost(null)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  // Placed before paint: above the trigger, or below it when there is no room, clamped to the viewport.
  useLayoutEffect(() => {
    if (!open || !anchor.current || !tip.current) return
    const el = tip.current
    el.style.padding = `0 0 ${GAP_PX}px`
    const a = anchor.current.getBoundingClientRect()
    const t = el.getBoundingClientRect()
    const maxLeft = Math.max(EDGE_PX, window.innerWidth - t.width - EDGE_PX)
    const below = a.top - t.height < EDGE_PX
    if (below) el.style.padding = `${GAP_PX}px 0 0`
    el.style.left = `${Math.min(maxLeft, Math.max(EDGE_PX, a.left + a.width / 2 - t.width / 2))}px`
    el.style.top = `${below ? a.bottom : a.top - t.height}px`
    el.style.visibility = 'visible'
  }, [open])

  const show = (): void => setHost(anchor.current?.closest('dialog') ?? document.body)
  const hoverOpen = (): void => {
    clear()
    timer.current = setTimeout(show, HOVER_DELAY_MS)
  }
  const close = (): void => {
    clear()
    setHost(null)
  }
  const focusOpen = (): void => {
    clear()
    show()
  }

  return (
    // The wrapper holds the pointer handlers; React events bubble through the portal, so the tip stays open while
    // the pointer is over it (WCAG 1.4.13). The tip's transparent padding bridges the gap to the trigger.
    <span ref={anchor} className="relative inline-flex" onMouseEnter={hoverOpen} onMouseLeave={close} onFocus={focusOpen} onBlur={close}>
      {cloneElement(children, { 'aria-describedby': open ? id : children.props['aria-describedby'] })}
      {host
        ? createPortal(
            <span ref={tip} className="invisible fixed z-50 block w-max max-w-xs">
              <span
                role="tooltip"
                id={id}
                className="block rounded-sm bg-ink px-2.5 py-1.5 text-left text-sm font-normal text-on-ink shadow-raised"
              >
                {content}
              </span>
            </span>,
            host,
          )
        : null}
    </span>
  )
}
