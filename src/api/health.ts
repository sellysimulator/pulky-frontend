/** Spec §13.6 wake-up probe. Never rejects; only a parsed `{status: "ok"}` counts. */
export async function probeHealth(timeoutMs = 5000): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? ''}/api/v1/health`, {
      signal: controller.signal,
    })
    if (!res.ok) return false
    const body: unknown = await res.json()
    return (
      typeof body === 'object' &&
      body !== null &&
      (body as { status?: unknown }).status === 'ok'
    )
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
