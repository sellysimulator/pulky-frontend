import type { ReactElement } from 'react'

interface SegmentedControlProps<T extends string> {
  /** The group's accessible name. */
  label: string
  options: ReadonlyArray<{ value: T; label: string }>
  value: T
  onChange(value: NoInfer<T>): void
}

/** One choice among a few views, as pressed buttons in one outlined group (the board view toggle's look). */
export default function SegmentedControl<T extends string>({ label, options, value, onChange }: SegmentedControlProps<T>): ReactElement {
  return (
    <span
      role="group"
      aria-label={label}
      className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-md border border-border-control bg-card p-0.5"
    >
      {options.map((option) => {
        const pressed = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={pressed}
            onClick={() => {
              if (!pressed) onChange(option.value)
            }}
            className={[
              'h-9 min-w-11 cursor-pointer rounded-sm px-3 text-sm font-semibold',
              pressed ? 'bg-accent text-on-accent' : 'text-ink-muted hover:bg-inset',
            ].join(' ')}
          >
            {option.label}
          </button>
        )
      })}
    </span>
  )
}
