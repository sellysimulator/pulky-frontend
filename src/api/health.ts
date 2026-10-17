/**
 * What one probe learned. `no-answer` is everything a sleeping or cold-starting
 * backend can produce: a network error, a timeout, a 5xx, a 408 or 429, or a
 * body that is not the health payload (Render's wake page, the Hosting SPA
 * rewrite). `rejected` is any other 4xx: the server is up and refuses the
 * path, so waiting will not help.
 */
export type HealthResult = { outcome: 'ok' } | { outcome: 'no-answer' } | { outcome: 'rejected'; httpStatus: number }

const NO_ANSWER: HealthResult = { outcome: 'no-answer' }

/** Statuses in the 4xx range that a busy or waking server can send. */
const TRANSIENT_4XX = new Set([408, 429])

/** Spec §13.6 wake-up probe. Never rejects; only a parsed `{status: "ok"}` counts as up. */
export async function probeHealth(timeoutMs = 5000): Promise<HealthResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? ''}/api/v1/health`, {
      signal: controller.signal,
    })
    if (res.status >= 400 && res.status < 500 && !TRANSIENT_4XX.has(res.status))
      return { outcome: 'rejected', httpStatus: res.status }
    if (!res.ok) return NO_ANSWER
    const body: unknown = await res.json()
    const up =
      typeof body === 'object' &&
      body !== null &&
      (body as { status?: unknown }).status === 'ok'
    return up ? { outcome: 'ok' } : NO_ANSWER
  } catch {
    return NO_ANSWER
  } finally {
    clearTimeout(timer)
  }
}
