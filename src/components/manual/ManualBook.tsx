import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactElement, type ReactNode } from 'react'
import HTMLFlipBook from 'react-pageflip'
import Button from '../shared/Button'

/** One leaf, in pixels: the page-flip library lays out and animates against fixed geometry. */
export const PAGE_WIDTH = 430
export const PAGE_HEIGHT = 620

/** Two leaves side by side, their shadow and the page gutters (spec §13.15). */
const SPREAD_QUERY = `(min-width: ${PAGE_WIDTH * 2 + 80}px)`

export interface ManualPageSpec {
  /** Stable key, and the anchor id when the pages are stacked. */
  id: string
  /** Omitted on the covers. A heading ending in ", continued" is left out of the contents. */
  heading?: string
  variant?: 'cover' | 'back'
  content: ReactNode
}

interface ManualBookProps {
  /** The running head of every inside page. */
  title: string
  pages: ManualPageSpec[]
}

interface FlipController {
  flipNext(): void
  flipPrev(): void
}

function subscribe(onChange: () => void): () => void {
  const list = window.matchMedia(SPREAD_QUERY)
  list.addEventListener('change', onChange)
  return () => list.removeEventListener('change', onChange)
}

function wideEnough(): boolean {
  return window.matchMedia(SPREAD_QUERY).matches
}

/** The same body in both modes: clipped to the leaf (and scrolling) in the book, flowing when stacked. */
function PageBody({ page, title, number, book }: { page: ManualPageSpec; title: string; number: number; book: boolean }): ReactElement {
  if (page.variant !== undefined) {
    return (
      <div className={['flex flex-col items-center justify-center gap-4 bg-accent-subtle px-8 text-center', book ? 'h-full' : 'py-12'].join(' ')}>
        {page.content}
      </div>
    )
  }
  return (
    <div className={book ? 'h-full overflow-y-auto' : ''}>
      <div className="flex items-baseline justify-between border-b border-border px-6 pt-5 pb-3 text-xs text-ink-subtle">
        <span className="font-semibold tracking-widest uppercase">{title}</span>
        <span className="tabular-nums">{number}</span>
      </div>
      {page.heading ? <h2 className="px-6 pt-4 text-lg">{page.heading}</h2> : null}
      <div className="flex flex-col gap-3 px-6 py-4 text-sm leading-relaxed">{page.content}</div>
    </div>
  )
}

/**
 * A manual as a page-turning book where a spread fits, and as the same pages
 * stacked where it does not (a phone, a narrow window, jsdom). Both render
 * every page, so nothing a reader needs depends on the mode.
 */
export default function ManualBook({ title, pages }: ManualBookProps): ReactElement {
  const book = useSyncExternalStore(subscribe, wideEnough, () => false)
  const bookRef = useRef<{ pageFlip(): FlipController | undefined }>(null)
  // The index the library reports on every turn: the cover, or the left leaf of the open spread.
  const [current, setCurrent] = useState(0)

  const flip = useCallback((direction: 'next' | 'prev'): void => {
    const controller = bookRef.current?.pageFlip()
    if (!controller) return
    if (direction === 'next') controller.flipNext()
    else controller.flipPrev()
  }, [])

  // The library's own ways through are a drag and a corner click; the arrow keys serve everyone else.
  useEffect(() => {
    if (!book) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'ArrowRight') flip('next')
      if (event.key === 'ArrowLeft') flip('prev')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [book, flip])

  const onFlip = useCallback((event: { data: number }): void => setCurrent(event.data), [])

  // Stable children: the library reloads every leaf whenever its children change identity.
  const leaves = useMemo(
    () =>
      pages.map((page, index) => (
        <div key={page.id} className="h-full w-full overflow-hidden bg-card text-ink">
          <PageBody page={page} title={title} number={index + 1} book />
        </div>
      )),
    [pages, title],
  )

  if (!book) {
    return (
      <div className="flex flex-col gap-6">
        {pages.map((page, index) => (
          <section key={page.id} id={page.id} className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
            <PageBody page={page} title={title} number={index + 1} book={false} />
          </section>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="shadow-raised">
        <HTMLFlipBook
          ref={bookRef}
          width={PAGE_WIDTH}
          height={PAGE_HEIGHT}
          size="fixed"
          minWidth={PAGE_WIDTH}
          maxWidth={PAGE_WIDTH}
          minHeight={PAGE_HEIGHT}
          maxHeight={PAGE_HEIGHT}
          drawShadow
          flippingTime={600}
          usePortrait={false}
          startZIndex={0}
          autoSize={false}
          maxShadowOpacity={0.4}
          showCover
          mobileScrollSupport={false}
          clickEventForward
          useMouseEvents
          swipeDistance={30}
          showPageCorners
          // A click in a page of prose selects text; it must not turn the page from under the sentence.
          disableFlipByClick
          startPage={0}
          className=""
          style={{}}
          onFlip={onFlip}
        >
          {leaves}
        </HTMLFlipBook>
      </div>
      <div className="flex items-center gap-4">
        <Button variant="secondary" icon={ChevronLeft} onClick={() => flip('prev')}>
          Previous
        </Button>
        <span className="text-sm text-ink-muted tabular-nums" aria-live="polite">
          Page {current + 1} of {pages.length}
        </span>
        <Button variant="primary" onClick={() => flip('next')}>
          Next
          <ChevronRight size={18} aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
