import { CircleAlert, TriangleAlert } from 'lucide-react'
import { useId, useState, type ReactElement, type ReactNode } from 'react'
import { WEEKDAYS, type ConfigFieldMeta, type GameConfig } from '../../types/game'
import { weekdayShort } from '../../utils/format'
import Collapsible from '../shared/Collapsible'
import NumberField from '../shared/NumberField'
import Select from '../shared/Select'
import Switch from '../shared/Switch'
import { DOCS } from './docs/entries'
import InfoButton from './docs/InfoButton'
import { getAt } from './configDraft'
import { HIDDEN_HELPER, HIDDEN_PLACEHOLDER, PIPELINE_WITHOUT_LEAD_TIME } from './hiddenDefaults'
import ShownToPlayersBadge from './ShownToPlayersBadge'

/** What every section body receives from the panel. */
export interface SectionProps {
  config: GameConfig
  fields: Record<string, ConfigFieldMeta>
  readOnly: boolean
  errors: Record<string, string>
  warnings: Record<string, string>
  onEdit(path: string, value: unknown): void
  onPatch(patch: object): void
  insuranceIssues?: Record<string, { kind: 'error' | 'warning'; message: string }>
}

/** Float keys that hold money (prices, costs, cash, fees, penalties). */
const MONEY_PATHS = new Set([
  'starting_cash',
  'demand.retail_price',
  'demand.backlog_penalty',
  'supplier.base_price',
  'stock.holding_cost',
  'stock.salvage_value',
  'stock.conservation_cost_per_unit',
  'transport.unit_cost',
])

/** The peak-window weekday choices, Mon to Sun. */
const WEEKDAY_OPTIONS = WEEKDAYS.map((d) => ({ value: d, label: weekdayShort(d) }))

const PERCENT_PATHS = new Set(['supplier.quality_min', 'supplier.quality_max'])

function bound(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 6 })
}

function labelOf(path: string): string {
  return (DOCS[path] as (typeof DOCS)[string] | undefined)?.label ?? path
}

function Messages({ id, error, warning }: { id: string; error?: string; warning?: string }): ReactElement | null {
  if (!error && !warning) return null
  return (
    <div className="col-span-2 flex flex-col gap-1 pt-1">
      {warning ? (
        <p id={`${id}-warning`} className="flex items-center gap-1.5 text-sm text-warning-ink">
          <TriangleAlert size={16} aria-hidden="true" className="text-warning" />
          {warning}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-sm text-danger-ink">
          <CircleAlert size={16} aria-hidden="true" className="text-danger" />
          {error}
        </p>
      ) : null}
    </div>
  )
}

interface ConfigFieldProps {
  path: string
  config: GameConfig
  meta: ConfigFieldMeta | undefined
  readOnly: boolean
  error?: string
  warning?: string
  onEdit(path: string, value: unknown): void
}

/** One knob row: label, InfoButton, the badge on shown keys, the bounds helper and the control. */
export default function ConfigField({ path, config, meta, readOnly, error, warning, onEdit }: ConfigFieldProps): ReactElement {
  const id = useId()
  const label = labelOf(path)
  const value = getAt(config, path)
  const type = meta?.type ?? (typeof value === 'boolean' ? 'bool' : typeof value === 'string' ? 'weekday' : 'float')
  const shown = meta?.players === 'shown'
  const hidden = meta?.hidden_default === true
  // Spec §13.9: the initial pipeline has no slot to fill without a lead time.
  const noEffect = path === 'supplier.initial_pipeline_qty' && config.supplier.lead_time_days === 0
  const helper =
    meta && meta.min !== null && meta.max !== null ? `Between ${bound(meta.min)} and ${bound(meta.max)}` : null

  const heading = (
    <div className="flex flex-wrap items-center gap-2">
      {type === 'bool' ? null : (
        <label htmlFor={id} className="text-base font-medium">
          {label}
        </label>
      )}
      <InfoButton entryKey={path} config={config} />
      {shown ? <ShownToPlayersBadge /> : null}
    </div>
  )

  let control: ReactNode
  if (type === 'bool') {
    control = null
  } else if (type === 'weekday') {
    const describedBy = [error ? `${id}-error` : null, warning ? `${id}-warning` : null].filter(Boolean).join(' ')
    control = (
      <Select
        id={id}
        value={typeof value === 'string' ? value : null}
        options={WEEKDAY_OPTIONS}
        disabled={readOnly}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        onChange={(next) => onEdit(path, next)}
        className={error ? '' : warning ? '[&>button]:border-warning' : ''}
      />
    )
  } else {
    const kind = type === 'int' ? 'quantity' : MONEY_PATHS.has(path) ? 'money' : 'decimal'
    control = (
      <NumberField
        id={id}
        label=""
        hideLabel
        kind={kind}
        value={typeof value === 'number' ? value : null}
        min={meta?.min ?? undefined}
        max={meta?.max ?? undefined}
        suffix={PERCENT_PATHS.has(path) ? '%' : undefined}
        placeholder={hidden ? HIDDEN_PLACEHOLDER : undefined}
        disabled={noEffect}
        readOnly={readOnly}
        error={error}
        warning={warning}
        onChange={(next) => onEdit(path, next)}
      />
    )
  }

  const ownMessages = type === 'bool' || type === 'weekday'

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 border-t border-border py-3 first:border-t-0">
      <div className="flex min-w-0 flex-col gap-1">
        {type === 'bool' ? (
          <div className="flex flex-wrap items-center gap-2">
            <Switch checked={value === true} disabled={readOnly} label={label} onChange={(next) => onEdit(path, next)} />
            <InfoButton entryKey={path} config={config} />
            {shown ? <ShownToPlayersBadge /> : null}
          </div>
        ) : (
          heading
        )}
        {helper ? <p className="text-sm text-ink-muted">{helper}</p> : null}
        {hidden ? <p className="text-sm text-ink-muted">{HIDDEN_HELPER}</p> : null}
        {noEffect && warning === undefined ? <p className="text-sm text-ink-muted">{PIPELINE_WITHOUT_LEAD_TIME}</p> : null}
      </div>
      <div className="flex items-start">{control}</div>
      {ownMessages ? <Messages id={id} error={error} warning={warning} /> : null}
    </div>
  )
}

/** The knob rows of a section, in the given order. */
export function Knobs({ paths, ...props }: { paths: string[] } & SectionProps): ReactElement {
  return (
    <div className="flex flex-col">
      {paths.map((path) => (
        <ConfigField
          key={path}
          path={path}
          config={props.config}
          meta={props.fields[path] as ConfigFieldMeta | undefined}
          readOnly={props.readOnly}
          error={props.errors[path]}
          warning={props.warnings[path]}
          onEdit={props.onEdit}
        />
      ))}
    </div>
  )
}

/** The knobs, then under the last one a closed-at-first Preview collapsible; it stays open once opened. */
export function SectionLayout({ knobs, preview }: { knobs: ReactNode; preview?: ReactNode }): ReactElement {
  const [open, setOpen] = useState(false)
  if (!preview) return <div>{knobs}</div>
  return (
    <div>
      {knobs}
      <div className="border-t border-border pt-3">
        <Collapsible variant="inline" summary="Preview" open={open} onOpenChange={setOpen}>
          <div className="flex flex-col gap-4">{preview}</div>
        </Collapsible>
      </div>
    </div>
  )
}
