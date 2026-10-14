import { Check } from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'

interface CheckboxProps {
  checked: boolean
  onChange(checked: boolean): void
  label: ReactNode
  disabled?: boolean
  trailing?: ReactNode
}

/** The whole row is the label, so the target is the row (design.md §7.4). */
export default function Checkbox({ checked, onChange, label, disabled = false, trailing }: CheckboxProps): ReactElement {
  return (
    <label
      className={[
        'flex min-h-11 items-center gap-3 rounded-md px-3 text-base',
        disabled ? 'cursor-not-allowed text-ink-subtle' : 'cursor-pointer hover:bg-inset',
        checked && !disabled ? 'bg-accent-subtle' : '',
        'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
      ].join(' ')}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={[
          'grid size-5 shrink-0 place-items-center rounded-xs border',
          disabled ? 'border-border bg-muted' : checked ? 'border-accent bg-accent text-on-accent' : 'border-border-control bg-card',
        ].join(' ')}
      >
        {checked && !disabled ? <Check size={14} strokeWidth={3} /> : null}
      </span>
      <span className="flex-1">{label}</span>
      {trailing ? <span className="tabular-nums">{trailing}</span> : null}
    </label>
  )
}
