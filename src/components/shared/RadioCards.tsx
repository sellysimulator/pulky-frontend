import { CircleCheck } from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'

interface RadioCardsProps<T extends string | number> {
  legend: string
  name: string
  value: T
  /** `info` sits beside the card, not inside its label, so the card stays a single labelable control. */
  options: Array<{ value: T; label: string; lines?: ReactNode[]; info?: ReactNode; disabled?: boolean }>
  onChange(value: T): void
  locked?: boolean
  hideLegend?: boolean
}

export default function RadioCards<T extends string | number>({
  legend,
  name,
  value,
  options,
  onChange,
  locked = false,
  hideLegend = false,
}: RadioCardsProps<T>): ReactElement {
  return (
    <fieldset className="min-w-0">
      <legend className={hideLegend ? 'sr-only' : 'mb-2 text-base font-medium'}>{legend}</legend>
      <div className="flex flex-col gap-2">
        {options.map((o) => {
          const checked = o.value === value
          const off = locked || Boolean(o.disabled)
          return (
            <div key={String(o.value)} className="relative">
              <label
                className={[
                  'relative flex h-full min-h-[4.5rem] flex-col gap-0.5 rounded-md border p-3',
                  locked ? 'bg-inset' : 'bg-card',
                  checked ? 'ring-2 ring-inset ring-accent' : '',
                  checked && !locked ? 'bg-accent-subtle' : '',
                  off ? 'cursor-not-allowed' : 'cursor-pointer hover:border-ink-subtle',
                  checked ? 'border-accent' : 'border-border-control',
                  'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name={name}
                  value={String(o.value)}
                  checked={checked}
                  disabled={off}
                  onChange={() => onChange(o.value)}
                  className="sr-only"
                />
                <span className="flex items-center gap-2 font-semibold">
                  <span
                    aria-hidden="true"
                    className={[
                      'grid size-[1.125rem] shrink-0 place-items-center rounded-full border',
                      checked ? 'border-accent bg-accent' : 'border-border-control bg-card',
                    ].join(' ')}
                  >
                    {checked ? <span className="size-1.5 rounded-full bg-on-accent" /> : null}
                  </span>
                  {o.label}
                </span>
                {o.lines?.map((line, i) => (
                  <span key={i} className="text-sm text-ink-muted tabular-nums">
                    {line}
                  </span>
                ))}
                {checked ? (
                  <CircleCheck
                    size={16}
                    aria-hidden="true"
                    className={['absolute top-2 right-2', locked ? 'text-ink-muted' : 'text-accent'].join(' ')}
                  />
                ) : null}
              </label>
              {o.info ? <span className="absolute right-2 bottom-2">{o.info}</span> : null}
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}
