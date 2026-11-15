import { ArrowLeftRight, Factory, RotateCcw, Settings2, Star, Truck, Users, Warehouse, type LucideIcon } from 'lucide-react'
import type { ComponentType, ReactElement, ReactNode } from 'react'
import { INSURED_TIERS, type ConfigFieldMeta, type FieldIssue, type GameConfig } from '../../types/game'
import { InlineAlert } from '../shared/AlertContainer'
import Button from '../shared/Button'
import SectionCard from '../shared/SectionCard'
import type { SectionProps } from './ConfigField'
import { SECTION_PATHS, sectionOf, type SectionId } from './configDraft'
import { ConfigPreviewContext, type ConfigPreviewState } from './configPreview'
import { DOCS } from './docs/entries'
import DemandSection from './sections/DemandSection'
import GameSection from './sections/GameSection'
import PeerMarketSection from './sections/PeerMarketSection'
import ReputationSection from './sections/ReputationSection'
import StockSection from './sections/StockSection'
import SupplierFuturesSection from './sections/SupplierFuturesSection'
import TransportInsuranceSection from './sections/TransportInsuranceSection'

interface SectionDef {
  id: SectionId
  title: string
  icon: LucideIcon
  Body: ComponentType<SectionProps>
}

/** Spec §13.9 order, with the design.md §6 icons. */
const SECTIONS: SectionDef[] = [
  { id: 'game', title: 'Game', icon: Settings2, Body: GameSection },
  { id: 'demand', title: 'Demand', icon: Users, Body: DemandSection },
  { id: 'reputation', title: 'Reputation', icon: Star, Body: ReputationSection },
  { id: 'supplier', title: 'Supplier & futures', icon: Factory, Body: SupplierFuturesSection },
  { id: 'stock', title: 'Stock', icon: Warehouse, Body: StockSection },
  { id: 'peer', title: 'Peer market', icon: ArrowLeftRight, Body: PeerMarketSection },
  { id: 'transport', title: 'Transport & insurance', icon: Truck, Body: TransportInsuranceSection },
]

const INSURANCE_PATHS = [
  'insurance.reference_shipment',
  'insurance.target_margin',
  ...INSURED_TIERS.flatMap((t) => [`insurance.tiers.${t}.enabled`, `insurance.tiers.${t}.fee`]),
]
const CONTROL_PATHS = new Set([...Object.values(SECTION_PATHS).flat(), ...INSURANCE_PATHS])

function insuranceIssues(errors: FieldIssue[], warnings: FieldIssue[]): Record<string, { kind: 'error' | 'warning'; message: string }> {
  const out: Record<string, { kind: 'error' | 'warning'; message: string }> = {}
  for (const [kind, list] of [['warning', warnings], ['error', errors]] as const) {
    for (const issue of list) {
      if (issue.field !== null && INSURANCE_PATHS.includes(issue.field)) out[issue.field] = { kind, message: issue.message }
    }
  }
  return out
}

function sectionElementId(id: SectionId): string {
  return `config-section-${id}`
}

function titleOf(path: string | null): string | undefined {
  if (path === null) return undefined
  return (DOCS[path] as (typeof DOCS)[string] | undefined)?.label
}

function byPath(issues: FieldIssue[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of issues) {
    if (issue.field !== null && CONTROL_PATHS.has(issue.field) && !(issue.field in out)) out[issue.field] = issue.message
  }
  return out
}

/** Issues whose field has no control: grouped by section, with null for the panel itself. */
function orphans(issues: FieldIssue[]): Map<SectionId | null, FieldIssue[]> {
  const out = new Map<SectionId | null, FieldIssue[]>()
  for (const issue of issues) {
    if (issue.field !== null && CONTROL_PATHS.has(issue.field)) continue
    const key = issue.field === null ? null : sectionOf(issue.field)
    out.set(key, [...(out.get(key) ?? []), issue])
  }
  return out
}

function IssueAlerts({ errors, warnings }: { errors: FieldIssue[]; warnings: FieldIssue[] }): ReactElement | null {
  if (errors.length === 0 && warnings.length === 0) return null
  return (
    <div className="flex flex-col gap-3 pb-3">
      {errors.map((issue, i) => (
        <InlineAlert key={`e${i}`} tone="danger" title={titleOf(issue.field)}>
          {issue.message}
        </InlineAlert>
      ))}
      {warnings.map((issue, i) => (
        <InlineAlert key={`w${i}`} tone="warning" title={titleOf(issue.field)}>
          {issue.message}
        </InlineAlert>
      ))}
    </div>
  )
}

interface ConfigSectionsProps {
  draft: GameConfig
  fields: Record<string, ConfigFieldMeta>
  errors: FieldIssue[]
  warnings: FieldIssue[]
  readOnly: boolean
  /** The server's figures for `draft` (`useConfigPreviewRequest`), shared by every section. */
  previewState: ConfigPreviewState
  onEdit(path: string, value: unknown): void
  onPatch(patch: object): void
  onReset(): void
  /** Alerts shown above everything else (a failed load or check). */
  notices?: ReactNode
}

/**
 * The config form itself: the seven sections (spec §13.9), their issues, the
 * jump row and **Reset to defaults**. It holds no state and knows no room, so
 * the host screen's `ConfigPanel` and the multi-game setup page
 * (`/multihost/new`) both render it over their own draft.
 */
export default function ConfigSections({
  draft,
  fields,
  errors,
  warnings,
  readOnly,
  previewState,
  onEdit,
  onPatch,
  onReset,
  notices,
}: ConfigSectionsProps): ReactElement {
  const jumpTo = (id: SectionId): void => {
    document.getElementById(sectionElementId(id))?.scrollIntoView?.({ block: 'start' })
  }

  const errorsByPath = byPath(errors)
  const warningsByPath = byPath(warnings)
  const insurance = insuranceIssues(errors, warnings)
  const errorOrphans = orphans(errors)
  const warningOrphans = orphans(warnings)

  return (
    <ConfigPreviewContext.Provider value={previewState}>
      <div className="flex flex-col gap-6">
        {notices}
        <IssueAlerts errors={errorOrphans.get(null) ?? []} warnings={warningOrphans.get(null) ?? []} />
        {readOnly ? null : (
          <div>
            <Button variant="secondary" icon={RotateCcw} onClick={onReset}>
              Reset to defaults
            </Button>
          </div>
        )}
        <nav aria-label="Settings sections" className="flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <Button key={s.id} variant="ghost" size="sm" onClick={() => jumpTo(s.id)}>
              {s.title}
            </Button>
          ))}
        </nav>
        {SECTIONS.map(({ id, title, icon, Body }) => (
          <SectionCard key={id} id={sectionElementId(id)} title={title} icon={icon}>
            <IssueAlerts errors={errorOrphans.get(id) ?? []} warnings={warningOrphans.get(id) ?? []} />
            <Body
              config={draft}
              fields={fields}
              readOnly={readOnly}
              errors={errorsByPath}
              warnings={warningsByPath}
              onEdit={onEdit}
              onPatch={onPatch}
              insuranceIssues={insurance}
            />
          </SectionCard>
        ))}
      </div>
    </ConfigPreviewContext.Provider>
  )
}
