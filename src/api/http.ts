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
