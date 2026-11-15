import { useCallback, useEffect, useState } from 'react'
import { errorMessage } from '../../api/http'
import { getRoomsSummary } from '../../api/rooms'
import type { HostedRoom, RoomSummary } from '../../types/game'

/** How often the dashboard asks for its rooms' seats and status. */
export const SUMMARY_POLL_MS = 5000

export const SUMMARY_FAILED = 'Could not refresh the games.'

function byCode(answer: RoomSummary[]): Record<string, RoomSummary> {
  return Object.fromEntries(answer.map((s) => [s.room_code, s]))
}

/**
 * Poll `POST /rooms/summary` for the batch's rooms. Skips a tick while the tab is
 * hidden and asks again as soon as it is shown. `refresh()` asks now and resolves with
 * that answer (null when it failed), so "Start all" can count from it. `rooms` must be
 * a stable reference (the dashboard keeps it in state).
 */
export function useRoomsSummary(rooms: HostedRoom[]): {
  summaries: Record<string, RoomSummary>
  error: string | null
  refresh(): Promise<Record<string, RoomSummary> | null>
} {
  const [summaries, setSummaries] = useState<Record<string, RoomSummary>>({})
  const [error, setError] = useState<string | null>(null)
  const refresh = useCallback(
    () =>
      getRoomsSummary(rooms).then(
        (answer) => {
          const next = byCode(answer)
          setSummaries(next)
          setError(null)
          return next
        },
        (err: unknown) => {
          setError(errorMessage(err, SUMMARY_FAILED))
          return null
        },
      ),
    [rooms],
  )

  useEffect(() => {
    if (rooms.length === 0) return
    let cancelled = false
    const poll = (): void => {
      if (document.hidden) return
      getRoomsSummary(rooms)
        .then((answer) => {
          if (cancelled) return
          setSummaries(byCode(answer))
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
  }, [rooms])

  return { summaries, error, refresh }
}
