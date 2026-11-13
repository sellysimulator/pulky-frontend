import { useCallback, useEffect, useState } from 'react'
import { errorMessage } from '../../api/http'
import { getRoomsSummary } from '../../api/rooms'
import type { HostedRoom, RoomSummary } from '../../types/game'

/** How often the dashboard asks for its rooms' seats and status. */
export const SUMMARY_POLL_MS = 5000

export const SUMMARY_FAILED = 'Could not refresh the games.'

/**
 * Poll `POST /rooms/summary` for the batch's rooms. Skips a tick while the tab is
 * hidden and asks again as soon as it is shown; `refresh()` asks now. `rooms` must be a
 * stable reference (the dashboard keeps it in state).
 */
export function useRoomsSummary(rooms: HostedRoom[]): {
  summaries: Record<string, RoomSummary>
  error: string | null
  refresh(): void
} {
  const [summaries, setSummaries] = useState<Record<string, RoomSummary>>({})
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (rooms.length === 0) return
    let cancelled = false
    const poll = (): void => {
      if (document.hidden) return
      getRoomsSummary(rooms)
        .then((answer) => {
          if (cancelled) return
          setSummaries(Object.fromEntries(answer.map((s) => [s.room_code, s])))
          setError(null)
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(errorMessage(err, SUMMARY_FAILED))
        })
    }
    poll()
    const timer = window.setInterval(poll, SUMMARY_POLL_MS)
    document.addEventListener('visibilitychange', poll)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', poll)
    }
  }, [rooms, tick])

  return { summaries, error, refresh }
}
