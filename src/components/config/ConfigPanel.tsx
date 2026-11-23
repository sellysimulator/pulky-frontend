import { useEffect, useRef, useState, type ReactElement } from 'react'
import { getConfigDefaults, validateConfig } from '../../api/config'
import { updateConfig } from '../../api/games'
import { RATE_LIMITED_RETRYING_MESSAGE } from '../../api/friendlyErrors'
import { errorMessage, isRateLimited, retryAfterMs } from '../../api/http'
import { getRoomConfig } from '../../api/rooms'
import { useGameStore } from '../../store/gameStore'
import type { ConfigDefaultsResponse, FieldIssue, GameConfig, ServerError } from '../../types/game'
import { InlineAlert } from '../shared/AlertContainer'
import LoadingSpinner from '../shared/LoadingSpinner'
import ConfigSections from './ConfigSections'
import { diffPatch, getAt, leafPaths, setAt } from './configDraft'
import { useConfigPreviewRequest } from './configPreview'

interface ConfigPanelProps {
  roomCode: string
  hostSecret: string | null
  locked: boolean
}

const DEBOUNCE_MS = 400
const LOAD_FALLBACK_MS = 1000
const LOAD_FAILED = 'Could not load the settings.'

export default function ConfigPanel({ roomCode, hostSecret, locked }: ConfigPanelProps): ReactElement {
  const storeConfig = useGameStore((s) => s.config) as GameConfig | null
  const lastError = useGameStore((s) => s.lastError)
  const clearLastError = useGameStore((s) => s.clearLastError)
  const setConfig = useGameStore((s) => s.setConfig)

  const [defaults, setDefaults] = useState<ConfigDefaultsResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [checkError, setCheckError] = useState<string | null>(null)
  // A check the rate limit refused (429) keeps the edit unsent and asks again after its Retry-After.
  const [busy, setBusy] = useState(false)
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
  // Every figure the panel shows comes from the server, for the draft on screen (spec §13.4, §13.10).
  const previewState = useConfigPreviewRequest(draft)

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
      if (token !== runRef.current) return
      if (isRateLimited(err)) {
        setCheckError(null)
        setBusy(true)
        timerRef.current = setTimeout(() => {
          timerRef.current = null
          void validateAndSend()
        }, retryAfterMs(err))
        return
      }
      setBusy(false)
      setCheckError(errorMessage(err, 'Could not check the settings.'))
      return
    }
    if (token !== runRef.current) return
    setBusy(false)
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

  const failure = loadError
  if (defaults === null || draft === null) {
    if (failure !== null) return <InlineAlert tone="danger">{failure}</InlineAlert>
    return <LoadingSpinner label="Loading the settings" />
  }

  return (
    <ConfigSections
      draft={draft}
      fields={defaults.fields}
      errors={errors}
      warnings={warnings}
      readOnly={readOnly}
      previewState={previewState}
      onEdit={onEdit}
      onPatch={onPatch}
      onReset={reset}
      notices={
        <>
          {failure !== null ? <InlineAlert tone="danger">{failure}</InlineAlert> : null}
          {busy ? <InlineAlert tone="info">{RATE_LIMITED_RETRYING_MESSAGE}</InlineAlert> : null}
          {checkError !== null ? <InlineAlert tone="danger">{checkError}</InlineAlert> : null}
        </>
      }
    />
  )
}
