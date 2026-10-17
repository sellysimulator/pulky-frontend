import type { ReactElement } from 'react'

/**
 * The jarrito: a clay pulque jug on an agave tile (design.md §2.7). Decorative,
 * because the "Pulky" wordmark always sits beside it. `public/favicon.svg`
 * draws the same shapes in hex.
 */
export default function BrandMark({ className = '' }: { className?: string }): ReactElement {
  return (
    <svg viewBox="0 0 352 352" aria-hidden="true" className={['shrink-0', className].join(' ')}>
      <rect width="352" height="352" rx="76" className="fill-agave" />
      <path
        fillRule="evenodd"
        className="fill-clay"
        d="M117 104C72 104 46 130 46 172A73 73 0 0 0 88 238H179V104ZM68.5 172a50.5 50.5 0 1 0 101 0a50.5 50.5 0 1 0-101 0Z"
      />
      <path className="fill-clay" d="M123 80H247C252 112 290 142 290 202A105 105 0 0 1 80 202C80 142 118 112 123 80Z" />
      <rect x="95" y="45" width="180" height="36" rx="18" className="fill-clay" />
      <ellipse cx="185" cy="60" rx="70" ry="9" className="fill-sage" />
      <path
        fill="none"
        strokeWidth="10"
        strokeLinecap="round"
        className="stroke-agave"
        d="M97 170H273M105 210Q121 197 137 210T169 210T201 210T233 210T265 210M117 250H253"
      />
    </svg>
  )
}
