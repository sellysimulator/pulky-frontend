import { useEffect, useState } from 'react'
import { isMyHostedGame } from '../../api/users'

interface Answer {
  gameId: string
  asker: object
  hosted: boolean
}

/**
 * Whether the signed-in viewer's account hosted this game (`GET /users/me/hosted-games/{id}`, the
 * rule the export applies to a bearer), so a host without this tab's host secret can still export.
 *
 * `asker` is the signed-in user to ask for (`useAuth().user`, a new object on every sign-in), or
 * null to ask nothing (a guest, or a viewer who already holds the secret) and answer false. Asked
 * once per game and per signed-in user: an answer is kept with the user it was given for, so after
 * signing in as someone else the previous account's "yes" is never shown while the new question is
 * in flight. Any failure is a quiet no: no export, no alert. An answer that arrives for another game
 * or user than the current one is ignored.
 */
export function useHostedGame(gameId: string | null, asker: object | null): boolean {
  const [answer, setAnswer] = useState<Answer | null>(null)

  useEffect(() => {
    if (asker === null || gameId === null) return
    let current = true
    void isMyHostedGame(gameId)
      .catch(() => false)
      .then((hosted) => {
        if (current) setAnswer({ gameId, asker, hosted })
      })
    return () => {
      current = false
    }
  }, [gameId, asker])

  return (
    asker !== null &&
    answer !== null &&
    answer.gameId === gameId &&
    answer.asker === asker &&
    answer.hosted
  )
}
