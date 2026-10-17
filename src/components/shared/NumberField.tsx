import { CircleAlert, TriangleAlert } from 'lucide-react'
import { useId, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react'

interface NumberFieldProps {
  label: string
  value: number | null
  onChange(value: number | null): void
  kind: 'quantity' | 'money' | 'decimal'
  min?: number
  max?: number
  prefix?: string
  suffix?: string
  context?: ReactNode
  error?: string
  warning?: string
  disabled?: boolean
  readOnly?: boolean
  hideLabel?: boolean
  id?: string
  name?: string
}

/** What the input may hold while it is being typed, per kind. */
function accepts(kind: NumberFieldProps['kind'], text: string, allowNegative: boolean): boolean {
  const sign = allowNegative ? '-?' : ''
  if (kind === 'quantity') return new RegExp(`^${sign}\\d*$`).test(text)
  if (kind === 'money') return new RegExp(`^${sign}\\d*\\.?\\d{0,2}$`).test(text)
  return new RegExp(`^${sign}\\d*\\.?\\d*$`).test(text)
}

/** The number a typed text stands for; null for an empty or unfinished one ("-", "."). */
function parse(text: string): number | null {
  if (text === '' || text === '-' || text === '.' || text === '-.') return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

function format(kind: NumberFieldProps['kind'], value: number | null): string {
  if (value === null) return ''
  return kind === 'money' ? value.toFixed(2) : String(value)
}

export default function NumberField({
  label,
  value,
  onChange,
  kind,
  min,
  max,
  prefix,
  suffix,
  context,
  error,
  warning,
  disabled = false,
  readOnly = false,
  hideLabel = false,
  id,
  name,
}: NumberFieldProps): ReactElement {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`
  const warningId = `${inputId}-warning`
  const contextId = `${inputId}-context`
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)

  const shownPrefix = prefix ?? (kind === 'money' ? '$' : undefined)
  // A unit spelled out as a word ("units", "/unit") takes 2rem more than a symbol (design.md §7.2).
  const wordSuffix = (suffix?.length ?? 0) > 2
  const width = kind === 'quantity' ? (wordSuffix ? 'w-36' : 'w-28') : wordSuffix ? 'w-40' : 'w-32'
  const allowNegative = min === undefined || min < 0
  // While typing, keep what was typed ("1." or "12.5") as long as it still means the current value.
  const showDraft = focused && draft !== null && (parse(draft) === value || parse(draft) === null)
  const shown = showDraft ? (draft as string) : format(kind, value)

  const describedBy = [error ? errorId : null, warning ? warningId : null, context ? contextId : null].filter(Boolean).join(' ')

  const handleChange = (text: string): void => {
    if (readOnly || disabled) return
    if (!accepts(kind, text, allowNegative)) return
    setDraft(text)
    const parsed = parse(text)
    if (text === '') onChange(null)
    else if (parsed !== null) onChange(parsed)
  }

  const step = (direction: 1 | -1): void => {
    const delta = kind === 'quantity' ? 1 : 0.01
    let next = Math.round(((value ?? 0) + direction * delta) * 100) / 100
    if (min !== undefined) next = Math.max(min, next)
    if (max !== undefined) next = Math.min(max, next)
    setDraft(null)
    onChange(next)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (readOnly || disabled) return
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      step(1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      step(-1)
    }
  }

  const border = error
    ? 'border-danger'
    : warning
      ? 'border-warning'
      : disabled
        ? 'border-border'
        : readOnly
          ? 'border-border'
          : 'border-border-control hover:border-ink-subtle focus-within:border-accent'
  const fill = disabled ? 'bg-muted text-ink-subtle' : readOnly ? 'bg-inset text-ink' : 'bg-card text-ink'

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className={hideLabel ? 'sr-only' : 'text-base font-medium'}>
        {label}
      </label>
      <div className={['flex h-11 items-center gap-1 rounded-md border px-3', width, border, fill].join(' ')}>
        {shownPrefix ? <span className="text-base text-ink-subtle">{shownPrefix}</span> : null}
        <input
          id={inputId}
          name={name}
          type="text"
          inputMode={kind === 'quantity' ? 'numeric' : 'decimal'}
          autoComplete="off"
          value={shown}
          min={min}
          max={max}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            setDraft(null)
          }}
          className="min-w-0 flex-1 bg-transparent text-right text-lg font-medium tabular-nums outline-none focus-visible:outline-none"
        />
        {suffix ? <span className="text-base text-ink-subtle">{suffix}</span> : null}
      </div>
      {context ? (
        <div id={contextId} className="text-sm text-ink-muted tabular-nums">
          {context}
        </div>
      ) : null}
      {warning ? (
        <p id={warningId} className="flex items-center gap-1.5 text-sm text-warning-ink">
          <TriangleAlert size={16} aria-hidden="true" className="text-warning" />
          {warning}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-center gap-1.5 text-sm text-danger-ink">
          <CircleAlert size={16} aria-hidden="true" className="text-danger" />
          {error}
        </p>
      ) : null}
    </div>
  )
}
