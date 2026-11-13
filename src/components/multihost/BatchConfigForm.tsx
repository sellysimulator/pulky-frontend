import { Layers } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react'
import { getConfigDefaults, useLimits, validateConfig } from '../../api/config'
import { errorMessage } from '../../api/http'
import type { ConfigDefaultsResponse, FieldIssue, GameConfig } from '../../types/game'
import { InlineAlert } from '../shared/AlertContainer'
import Button from '../shared/Button'
import LoadingSpinner from '../shared/LoadingSpinner'
import NumberField from '../shared/NumberField'
import SectionCard from '../shared/SectionCard'
import ConfigSections from '../config/ConfigSections'
import { diffPatch, getAt, leafPaths, setAt } from '../config/configDraft'
import { useConfigPreviewRequest } from '../config/configPreview'

const DEBOUNCE_MS = 400
const LOAD_FAILED = 'Could not load the settings.'
const NAME_FIELD =
  'h-11 w-full rounded-md border border-border-control bg-card px-3 text-base hover:border-ink-subtle focus:border-accent'

interface BatchConfigFormProps {
  submitting: boolean
  /** `patch` is the draft's difference from the defaults, as `POST /rooms/batch-create` takes it. */
  onCreate(count: number, patch: object, hostDisplayName: string): void
}

/**
 * The multi-game setup form: how many games, the host's name, and one config for all
 * of them. The config is the host screen's own form (`ConfigSections`) over a local
 * draft, checked by `POST /config/validate` and previewed by `POST /config/preview`
 * like the lobby's; no room exists yet, so nothing is sent until **Create**.
 */
export default function BatchConfigForm({ submitting, onCreate }: BatchConfigFormProps): ReactElement {
  const limits = useLimits()
  const minCount = limits?.MIN_BATCH_ROOMS
  const maxCount = limits?.MAX_BATCH_ROOMS

  const [defaults, setDefaults] = useState<ConfigDefaultsResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [draft, setDraft] = useState<GameConfig | null>(null)
  const [errors, setErrors] = useState<FieldIssue[]>([])
  const [warnings, setWarnings] = useState<FieldIssue[]>([])
  const [checking, setChecking] = useState(false)
  // Untouched, the count follows the server's minimum once the limits arrive.
  const [typedCount, setCount] = useState<number | null | undefined>(undefined)
  const count = typedCount === undefined ? (minCount ?? null) : typedCount
  const [name, setName] = useState('')

  const draftRef = useRef<GameConfig | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runRef = useRef(0)
  const previewState = useConfigPreviewRequest(draft)

  useEffect(() => {
    let cancelled = false
    getConfigDefaults()
      .then((d) => {
        if (cancelled) return
        setDefaults(d)
        draftRef.current = d.config
        setDraft(d.config)
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(errorMessage(err, LOAD_FAILED))
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      runRef.current += 1
    },
    [],
  )

  const check = async (): Promise<void> => {
    const sent = draftRef.current
    if (sent === null) return
    const token = ++runRef.current
    try {
      const result = await validateConfig(sent)
      if (token !== runRef.current) return
      setCheckError(null)
      setErrors(result.errors)
      setWarnings(result.warnings)
    } catch (err) {
      if (token === runRef.current) setCheckError(errorMessage(err, 'Could not check the settings.'))
    } finally {
      if (token === runRef.current) setChecking(false)
    }
  }

  const commit = (next: GameConfig, touched: string[], immediate = false): void => {
    draftRef.current = next
    runRef.current += 1
    setDraft(next)
    setChecking(true)
    setErrors((prev) => prev.filter((i) => i.field === null || !touched.includes(i.field)))
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(
      () => {
        timerRef.current = null
        void check()
      },
      immediate ? 0 : DEBOUNCE_MS,
    )
  }

  const onEdit = (path: string, value: unknown): void => {
    const current = draftRef.current
    if (current !== null) commit(setAt(current, path, value), [path])
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
    if (defaults !== null) commit(defaults.config, leafPaths(defaults.config), true)
  }

  if (defaults === null || draft === null) {
    if (loadError !== null) return <InlineAlert tone="danger">{loadError}</InlineAlert>
    return <LoadingSpinner label="Loading the settings" />
  }

  const countError =
    count === null || !Number.isInteger(count) || (minCount !== undefined && count < minCount) || (maxCount !== undefined && count > maxCount)
      ? minCount !== undefined && maxCount !== undefined
        ? `Must be between ${minCount} and ${maxCount}.`
        : 'Must be a whole number.'
      : undefined
  const blocked = countError !== undefined || errors.length > 0 || checking || checkError !== null

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    if (blocked || submitting || count === null) return
    onCreate(count, diffPatch(defaults.config, draft), name.trim())
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Games" icon={Layers}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <NumberField
            label="Number of games"
            kind="quantity"
            value={count}
            onChange={setCount}
            min={minCount}
            max={maxCount}
            error={countError}
            context="Each game gets its own code, invite link and host screen."
          />
          <div className="flex flex-col gap-2">
            <label htmlFor="batch-host-name" className="text-base font-medium">
              Your name
            </label>
            <input
              id="batch-host-name"
              name="host_display_name"
              type="text"
              value={name}
              maxLength={limits?.MAX_DISPLAY_NAME}
              autoComplete="off"
              onChange={(e) => setName(e.target.value)}
              className={NAME_FIELD}
            />
          </div>
          {errors.length > 0 ? (
            <InlineAlert tone="danger">Fix the settings marked in red before creating the games.</InlineAlert>
          ) : null}
          <div>
            <Button type="submit" variant="primary" disabled={blocked} loading={submitting}>
              {count !== null && countError === undefined ? `Create ${count} games` : 'Create games'}
            </Button>
          </div>
        </form>
      </SectionCard>
      <ConfigSections
        draft={draft}
        fields={defaults.fields}
        errors={errors}
        warnings={warnings}
        readOnly={false}
        previewState={previewState}
        onEdit={onEdit}
        onPatch={onPatch}
        onReset={reset}
        notices={checkError !== null ? <InlineAlert tone="danger">{checkError}</InlineAlert> : null}
      />
    </div>
  )
}
