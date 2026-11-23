import axios from 'axios'
import { auth } from '../../firebase'
import {
  TOO_LARGE_MESSAGE,
  serverMessageText,
  serviceUnavailableMessage,
  tooManyRequestsMessage,
} from './friendlyErrors'

const http = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/v1`,
})

http.interceptors.request.use(async (config) => {
  const user = auth.currentUser
  if (user) {
    const token = await user.getIdToken()
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

interface ErrorResponse {
  status?: number
  headers?: Record<string, unknown> & { get?: (name: string) => unknown }
  data?: { detail?: unknown }
}

function header(headers: ErrorResponse['headers'], name: string): unknown {
  if (!headers) return undefined
  return typeof headers.get === 'function' ? headers.get(name) : headers[name]
}

/** True for a refusal by the backend's rate limit (HTTP 429). */
export function isRateLimited(err: unknown): boolean {
  return (err as { response?: ErrorResponse } | null | undefined)?.response?.status === 429
}

/**
 * How long to wait before asking again after a 429 (spec §0.6): its `Retry-After` in seconds,
 * held between 1 s and a minute, or `fallbackMs` when the header is missing or unreadable (the
 * browser hides it unless CORS exposes it). For a request the screen waits on, so a rate limit
 * delays it instead of leaving the screen stuck.
 */
export function retryAfterMs(err: unknown, fallbackMs = 5000): number {
  const raw = header((err as { response?: ErrorResponse } | null | undefined)?.response?.headers, 'retry-after')
  const text = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : ''
  const seconds = /^\d+$/.test(text) ? Number(text) : 0
  if (seconds <= 0) return fallbackMs
  return Math.min(60_000, Math.max(1000, seconds * 1000))
}

/**
 * Spec §13.6: every API error renders as a string, never an object. The abuse limits'
 * refusals (spec §0.6: 429, 413, 503) read in the player's words, not the server's.
 */
export function errorMessage(err: unknown, fallback: string): string {
  const response = (err as { response?: ErrorResponse } | null | undefined)?.response
  const detail = response?.data?.detail
  if (response?.status === 429) return tooManyRequestsMessage(header(response.headers, 'retry-after'))
  if (response?.status === 413) return TOO_LARGE_MESSAGE
  if (response?.status === 503) return serviceUnavailableMessage(detail)
  if (typeof detail === 'string' && detail.trim()) return serverMessageText(detail)
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d: unknown) => {
        const msg = (d as { msg?: unknown } | null | undefined)?.msg
        return typeof msg === 'string' ? msg : null
      })
      .filter((m): m is string => m !== null)
    if (msgs.length) return msgs.join('; ')
  }
  return fallback
}

export default http
