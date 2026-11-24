import { io } from 'socket.io-client'
import { auth } from '../../firebase'
import { getOrCreateGuestId } from '../utils/storage'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? ''

/**
 * Spec §13.6 handshake [HARD-WON]: `autoConnect: false`, so AuthContext connects
 * once auth has resolved. The `auth` callback runs on every (re)connect and so
 * sends a fresh ID token each time. Reconnection never gives up (no attempt cap; the
 * default is unlimited), waiting at most 10 s between attempts.
 *
 * Signed in, a token that cannot be read is never replaced by the guest id: the
 * handshake goes out with no identity, the server refuses it, and `socketHandlers`
 * retries while the user is still signed in (spec §11.3).
 */
export const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  autoConnect: false,
  reconnection: true,
  reconnectionDelayMax: 10_000,
  path: '/socket.io',
  auth: (cb) => {
    const user = auth.currentUser
    if (user) {
      user
        .getIdToken()
        .then((idToken) => cb({ idToken, guestId: null }))
        .catch(() => cb({ idToken: null, guestId: null }))
    } else {
      cb({ idToken: null, guestId: getOrCreateGuestId() })
    }
  },
})
