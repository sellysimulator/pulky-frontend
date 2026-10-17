import { ArrowLeftRight, Factory, RotateCcw, Settings2, Star, Truck, Users, Warehouse, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState, type ComponentType, type ReactElement } from 'react'
import { getConfigDefaults, validateConfig } from '../../api/config'
import { updateConfig } from '../../api/games'
import { errorMessage } from '../../api/http'
import { getRoomConfig } from '../../api/rooms'
import { useGameStore } from '../../store/gameStore'
import { INSURED_TIERS, type ConfigDefaultsResponse, type FieldIssue, type GameConfig, type ServerError } from '../../types/game'
import { InlineAlert } from '../shared/AlertContainer'
import Button from '../shared/Button'
import LoadingSpinner from '../shared/LoadingSpinner'
import SectionCard from '../shared/SectionCard'
import type { SectionProps } from './ConfigField'
import { SECTION_PATHS, diffPatch, getAt, leafPaths, sectionOf, setAt, type SectionId } from './configDraft'
import { DOCS } from './docs/entries'
import DemandSection from './sections/DemandSection'
import GameSection from './sections/GameSection'
import PeerMarketSection from './sections/PeerMarketSection'
import ReputationSection from './sections/ReputationSection'
import StockSection from './sections/StockSection'
import SupplierFuturesSection from './sections/SupplierFuturesSection'
import TransportInsuranceSection from './sections/TransportInsuranceSection'

interface ConfigPanelProps {
  roomCode: string
  hostSecret: string | null
  locked: boolean
}

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

const DEBOUNCE_MS = 400
const LOAD_FALLBACK_MS = 1000
const LOAD_FAILED = 'Could not load the settings.'

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

export default function ConfigPanel({ roomCode, hostSecret, locked }: ConfigPanelProps): ReactElement {
  const storeConfig = useGameStore((s) => s.config) as GameConfig | null
  const lastError = useGameStore((s) => s.lastError)
  const clearLastError = useGameStore((s) => s.clearLastError)
  const setConfig = useGameStore((s) => s.setConfig)

  const [defaults, setDefaults] = useState<ConfigDefaultsResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [draft, setDraft] = useState<GameConfig | null>(null)
  const [unsent, setUnsent] = useState(false)
  const [seenStore, setSeenStore] = useState<GameConfig | null>(null)
  const [errors, setErrors] = useState<FieldIssue[]>([])
  const [warnings, setWarnings] = useState<FieldIssue[]>([])
  const [handledError, setHandledError] = useState<ServerError | null>(null)

  const draftRef = useRef<GameConfig | null>(null)
  const storeRef = useRef<GameConfig | null>(null)
  const propsRef = useRef({ roomCode, hostSecret, locked })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runRef = useRef(0)

  const readOnly = locked || hostSecret === null

  // The draft follows the store while it holds no unsent edit.
  if (storeConfig !== seenStore) {
    setSeenStore(storeConfig)
    if (storeConfig !== null && !unsent) setDraft(storeConfig)
  }

  // A socket INVALID_CONFIG error is shown at its field like a validate error.
  if (lastError !== null && lastError.code === 'INVALID_CONFIG' && lastError !== handledError) {
    setHandledError(lastError)
    const field = lastError.field ?? null
    setErrors((prev) => [...prev.filter((i) => i.field !== field), { field, message: lastError.message }])
  }

  useEffect(() => {
    draftRef.current = draft
    storeRef.current = storeConfig
    propsRef.current = { roomCode, hostSecret, locked }
  })

  useEffect(() => {
    if (lastError !== null && lastError.code === 'INVALID_CONFIG') clearLastError()
  }, [lastError, clearLastError])

  useEffect(() => {
    let cancelled = false
    getConfigDefaults()
      .then((d) => {
        if (!cancelled) setDefaults(d)
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(errorMessage(err, LOAD_FAILED))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const hasConfig = storeConfig !== null
  useEffect(() => {
    if (hasConfig || hostSecret === null) return
    const id = setTimeout(() => {
      getRoomConfig(roomCode, hostSecret)
        .then((c) => setConfig(c))
        .catch((err: unknown) => setLoadError(errorMessage(err, LOAD_FAILED)))
    }, LOAD_FALLBACK_MS)
    return () => clearTimeout(id)
  }, [hasConfig, hostSecret, roomCode, setConfig])

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      runRef.current += 1
    },
    [],
  )

  const validateAndSend = async (): Promise<void> => {
    const sent = draftRef.current
    if (sent === null) return
    const token = ++runRef.current
    let result
    try {
      result = await validateConfig(sent)
    } catch (err) {
      if (token === runRef.current) setCheckError(errorMessage(err, 'Could not check the settings.'))
      return
    }
    if (token !== runRef.current) return
    setCheckError(null)
    setErrors(result.errors)
    setWarnings(result.warnings)
    if (result.errors.length > 0) return
    const base = storeRef.current
    const { roomCode: code, hostSecret: secret, locked: isLocked } = propsRef.current
    if (base !== null && secret !== null && !isLocked) {
      const patch = diffPatch(base, sent)
      if (Object.keys(patch).length > 0) updateConfig(code, secret, patch)
    }
    setUnsent(false)
  }

  const commit = (next: GameConfig, touched: string[], immediate = false): void => {
    draftRef.current = next
    runRef.current += 1
    setDraft(next)
    setUnsent(true)
    setErrors((prev) => prev.filter((i) => i.field === null || !touched.includes(i.field)))
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(
      () => {
        timerRef.current = null
        void validateAndSend()
      },
      immediate ? 0 : DEBOUNCE_MS,
    )
  }

  const onEdit = (path: string, value: unknown): void => {
    const current = draftRef.current
    if (current === null) return
    commit(setAt(current, path, value), [path])
  }

  const onPatch = (patch: object): void => {
    const current = draftRef.current
    if (current === null) return
    const touched = leafPaths(patch)
    let next = current
    for (const path of touched) next = setAt(next, path, getAt(patch, path))
    commit(next, touched)
  }

  const reset = (): void => {
    if (defaults === null) return
    commit(defaults.config, leafPaths(defaults.config), true)
  }

  const jumpTo = (id: SectionId): void => {
    document.getElementById(sectionElementId(id))?.scrollIntoView?.({ block: 'start' })
  }

  const failure = loadError
  if (defaults === null || draft === null) {
    if (failure !== null) return <InlineAlert tone="danger">{failure}</InlineAlert>
    return <LoadingSpinner label="Loading the settings" />
  }

  const errorsByPath = byPath(errors)
  const warningsByPath = byPath(warnings)
  const insurance = insuranceIssues(errors, warnings)
  const errorOrphans = orphans(errors)
  const warningOrphans = orphans(warnings)

  return (
    <div className="flex flex-col gap-6">
      {failure !== null ? <InlineAlert tone="danger">{failure}</InlineAlert> : null}
      {checkError !== null ? <InlineAlert tone="danger">{checkError}</InlineAlert> : null}
      <IssueAlerts errors={errorOrphans.get(null) ?? []} warnings={warningOrphans.get(null) ?? []} />
      {readOnly ? null : (
        <div>
          <Button variant="secondary" icon={RotateCcw} onClick={reset}>
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
            fields={defaults.fields}
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
  )
}
