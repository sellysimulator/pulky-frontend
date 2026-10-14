import axios from 'axios'
import { auth } from '../../firebase'

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

/** Spec §13.6: every API error renders as a string, never an object. */
export function errorMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } } | null | undefined)
    ?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
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
