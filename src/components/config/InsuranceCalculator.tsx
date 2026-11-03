import { Calculator, CircleAlert, CircleCheck, CircleSlash, Scale, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ReactElement } from 'react'
import type { CalculatorCase, CalculatorTier, ConfigFieldMeta, GameConfig, RatioBadge } from '../../types/game'
import { INCOTERM_TIER_NAMES, PREVIEW_PLACEHOLDER, formatMoney, formatPercent } from '../../utils/format'
import { InlineAlert } from '../shared/AlertContainer'
import Badge from '../shared/Badge'
import Button from '../shared/Button'
import DataTable from '../shared/DataTable'
import NumberField from '../shared/NumberField'
import StatTile from '../shared/StatTile'
import Switch from '../shared/Switch'
import { previewGap, useConfigPreview } from './configPreview'
import { DOCS } from './docs/entries'
import InfoButton from './docs/InfoButton'
import { CALCULATOR_HIDDEN_NOTE, HIDDEN_FIGURE } from './hiddenDefaults'

interface InsuranceCalculatorProps {
  config: GameConfig
  onChange(patch: object): void
  readOnly: boolean
  issues?: Record<string, { kind: 'error' | 'warning'; message: string }>
  /** `GET /config/defaults` field entries: the inputs' bounds come from the server (spec §13.9). */
  fields?: Record<string, ConfigFieldMeta>
}

const VERDICTS: Record<RatioBadge, { tone: 'success' | 'info' | 'warning' | 'neutral'; icon: LucideIcon; text: string }> = {
  worth_it: { tone: 'success', icon: CircleCheck, text: 'Worth it' },
  break_even: { tone: 'info', icon: Scale, text: 'Break-even' },
  not_worth_it: { tone: 'warning', icon: TriangleAlert, text: 'Not worth it on average' },
  no_risk: { tone: 'neutral', icon: CircleSlash, text: 'No risk configured' },
}

interface CaseRow {
  key: string
  transport: string
  figures: CalculatorCase | null
}

function Verdict({ badge }: { badge: RatioBadge }): ReactElement {
  const v = VERDICTS[badge]
  return (
    <Badge tone={v.tone} icon={v.icon}>
      {v.text}
    </Badge>
  )
}

function docLabel(path: string): string {
  return (DOCS[path] as (typeof DOCS)[string] | undefined)?.label ?? path
}

function Muted({ text }: { text: string }): ReactElement {
  return <span className="text-ink-muted">{text}</span>
}

/**
 * Spec §6.4: every figure here is the server's (`POST /config/preview`, `calculator` and `transport.failures`),
 * computed from the engine's own insurance functions for the draft; this component computes none. A figure that
 * needs the failure chance or the loss share reads Hidden until the game ends while either is a hidden default.
 */
export default function InsuranceCalculator({ config, onChange, readOnly, issues = {}, fields = {} }: InsuranceCalculatorProps): ReactElement {
  const state = useConfigPreview()
  const preview = state.preview
  const calc = preview?.calculator ?? null
  const gap = previewGap(state)
  const bounds = (path: string): { min?: number; max?: number } => {
    const meta = fields[path] as ConfigFieldMeta | undefined
    return { min: meta?.min ?? undefined, max: meta?.max ?? undefined }
  }
  /** What a cell shows where a figure is missing: the hidden note, or the loading / unavailable line. */
  const missing = (): ReactElement => <Muted text={calc === null ? PREVIEW_PLACEHOLDER : HIDDEN_FIGURE} />

  const failures = preview?.transport.failures ?? null
  const failureLine = (value: (f: { chance_any: number; expected: number }) => string): string => {
    if (preview === null) return PREVIEW_PLACEHOLDER
    return failures === null ? HIDDEN_FIGURE : value(failures)
  }

  const tierOf = (tier: CalculatorTier['tier']): CalculatorTier | undefined => calc?.tiers.find((t) => t.tier === tier)

  const target = calc === null ? '' : calc.target_ratio.toFixed(2)
  const outOfSync = (calc?.tiers ?? []).flatMap((t) => {
    if (!t.enabled || t.in_sync !== false || t.current === null || t.current.ratio === null) return []
    return [`${INCOTERM_TIER_NAMES[t.tier]} ratio ${t.current.ratio.toFixed(2)} — target ${target}`]
  })

  const canSetFees = calc !== null && calc.known
  const setFees = (): void => {
    if (calc === null || !calc.known) return
    const tiers: Record<string, { fee: number }> = {}
    for (const t of calc.tiers) {
      if (t.enabled && t.current !== null) tiers[t.tier] = { fee: t.current.fee_from_margin }
    }
    if (Object.keys(tiers).length > 0) onChange({ insurance: { tiers } })
  }

  const errorAt = (path: string): string | undefined => (issues[path]?.kind === 'error' ? issues[path].message : undefined)
  const warningAt = (path: string): string | undefined => (issues[path]?.kind === 'warning' ? issues[path].message : undefined)
  const messageFor = (path: string): ReactElement | null => {
    const issue = issues[path] as { kind: 'error' | 'warning'; message: string } | undefined
    if (!issue) return null
    return (
      <p
        id={`${path}-issue`}
        className={['flex items-center gap-1.5 text-sm', issue.kind === 'error' ? 'text-danger-ink' : 'text-warning-ink'].join(' ')}
      >
        {issue.kind === 'error' ? (
          <CircleAlert size={16} aria-hidden="true" className="text-danger" />
        ) : (
          <TriangleAlert size={16} aria-hidden="true" className="text-warning" />
        )}
        {issue.message}
      </p>
    )
  }
  const sharedLabel = `Shared with ${config.max_players}`
  const dim = (enabled: boolean): string => (enabled ? '' : 'text-ink-subtle')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Calculator size={20} aria-hidden="true" className="text-ink-muted" />
        <h3 className="text-base font-semibold">Insurance calculator</h3>
      </div>
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
        <div className="flex items-end gap-1">
          <NumberField
            label="Reference shipment (units)"
            kind="quantity"
            {...bounds('insurance.reference_shipment')}
            value={config.insurance.reference_shipment}
            readOnly={readOnly}
            error={errorAt('insurance.reference_shipment')}
            warning={warningAt('insurance.reference_shipment')}
            onChange={(v) => onChange({ insurance: { reference_shipment: v } })}
          />
          <InfoButton entryKey="insurance.reference_shipment" config={config} />
        </div>
        <div className="flex items-end gap-1">
          <NumberField
            label="Target margin"
            kind="decimal"
            {...bounds('insurance.target_margin')}
            value={config.insurance.target_margin}
            readOnly={readOnly}
            error={errorAt('insurance.target_margin')}
            warning={warningAt('insurance.target_margin')}
            onChange={(v) => onChange({ insurance: { target_margin: v } })}
          />
          <InfoButton entryKey="insurance.target_margin" config={config} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
        <StatTile label="Chance of at least one failure" value={failureLine((f) => formatPercent(f.chance_any))} />
        <StatTile label="Expected failures" value={failureLine((f) => f.expected.toFixed(1))} />
      </div>
      {(['cip', 'dap', 'ddp'] as const).map((tier) => {
        const enabled = config.insurance.tiers[tier].enabled
        const name = INCOTERM_TIER_NAMES[tier]
        const figures = tierOf(tier)
        const cases: CaseRow[] = [
          { key: 'solo', transport: 'Not shared', figures: figures?.solo ?? null },
          { key: 'shared', transport: sharedLabel, figures: figures?.shared ?? null },
        ]
        return (
          <div key={tier} role="group" aria-label={name} className="flex flex-col gap-3 rounded-md border border-border p-4">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{name}</span>
                <Switch
                  checked={enabled}
                  disabled={readOnly}
                  label={docLabel(`insurance.tiers.${tier}.enabled`)}
                  onChange={(v) => onChange({ insurance: { tiers: { [tier]: { enabled: v } } } })}
                />
                <InfoButton entryKey={`insurance.tiers.${tier}.enabled`} config={config} />
                {enabled ? null : <Badge tone="neutral">Not offered</Badge>}
              </div>
              {messageFor(`insurance.tiers.${tier}.enabled`)}
            </div>
            <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
              <div className="flex items-start gap-2">
                <span aria-hidden="true" className="pt-3 text-sm text-ink-muted">
                  Fee per unit
                </span>
                <NumberField
                  label={docLabel(`insurance.tiers.${tier}.fee`)}
                  error={errorAt(`insurance.tiers.${tier}.fee`)}
                  warning={warningAt(`insurance.tiers.${tier}.fee`)}
                  hideLabel
                  kind="money"
                  {...bounds(`insurance.tiers.${tier}.fee`)}
                  value={config.insurance.tiers[tier].fee}
                  readOnly={readOnly}
                  onChange={(v) => onChange({ insurance: { tiers: { [tier]: { fee: v } } } })}
                />
                <InfoButton entryKey={`insurance.tiers.${tier}.fee`} config={config} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-ink-muted">Refund per lost unit</span>
                <span className={['font-semibold tabular-nums', dim(enabled)].join(' ')}>
                  {figures === undefined ? PREVIEW_PLACEHOLDER : formatMoney(figures.refund_value)}
                </span>
              </div>
            </div>
            <DataTable
              caption={`${name} break-even`}
              density="compact"
              columns={[
                { key: 'transport', header: 'Transport', render: (c: CaseRow) => <span className={dim(enabled)}>{c.transport}</span> },
                {
                  key: 'break-even',
                  header: 'Break-even',
                  align: 'right',
                  render: (c) => <span className={dim(enabled)}>{c.figures === null ? missing() : formatMoney(c.figures.break_even)}</span>,
                },
                {
                  key: 'verdict',
                  header: 'Verdict',
                  render: (c) => <span className={dim(enabled)}>{c.figures === null ? missing() : <Verdict badge={c.figures.badge} />}</span>,
                },
                {
                  key: 'worst',
                  header: 'Worst single failure',
                  align: 'right',
                  render: (c) => (
                    <span className={dim(enabled)}>{c.figures === null ? missing() : formatMoney(c.figures.worst_single_failure)}</span>
                  ),
                },
              ]}
              rows={cases}
              rowKey={(c) => c.key}
            />
          </div>
        )
      })}
      <div className="flex flex-col gap-3">
        {outOfSync.map((text) => (
          <InlineAlert key={text} tone="warning">
            {text}
          </InlineAlert>
        ))}
        {readOnly ? null : (
          <div className="flex flex-col gap-2">
            <div>
              <Button variant="secondary" onClick={setFees} disabled={!canSetFees}>
                Set fees from margin
              </Button>
            </div>
            {calc === null ? <p className="text-sm text-ink-muted">{gap}</p> : null}
            {calc !== null && !calc.known ? <p className="text-sm text-ink-muted">{CALCULATOR_HIDDEN_NOTE}</p> : null}
          </div>
        )}
      </div>
    </div>
  )
}
