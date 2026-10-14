import { io } from 'socket.io-client'
import { auth } from '../../firebase'
import { getOrCreateGuestId } from '../utils/storage'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? ''

/**
 * Spec §13.6 handshake [HARD-WON]: `autoConnect: false`, so AuthContext connects
 * once auth has resolved. The `auth` callback runs on every (re)connect and so
 * sends a fresh ID token each time.
 */
export const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  autoConnect: false,
  reconnection: true,
  path: '/socket.io',
  auth: (cb) => {
    const user = auth.currentUser
    if (user) {
      user
        .getIdToken()
        .then((idToken) => cb({ idToken, guestId: null }))
        .catch(() => cb({ idToken: null, guestId: getOrCreateGuestId() }))
    } else {
      cb({ idToken: null, guestId: getOrCreateGuestId() })
    }
  },
})
