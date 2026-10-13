/**
 * Firebase web configuration for the Pulky project (`pulky-da26c`).
 *
 * These are public identifiers: they ship in the JavaScript bundle to every
 * visitor. Firebase security comes from Auth and API-key restrictions, not from
 * hiding them, so the values live here as literals and this file is COMMITTED.
 * Never gitignore it while `src/` imports it: CI could no longer build the
 * frontend (pulky-game-spec.md §13.13 checklist).
 *
 * To point the app at another project, change it here and in `.firebaserc`;
 * there is no environment override.
 */
import { initializeApp } from 'firebase/app'
import {
  browserLocalPersistence,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyBfN4zEiMll2QByH_OOLVzQ7Y5PygF4z4o',
  authDomain: 'pulky-da26c.firebaseapp.com',
  projectId: 'pulky-da26c',
  storageBucket: 'pulky-da26c.firebasestorage.app',
  messagingSenderId: '348262526432',
  appId: '1:348262526432:web:55de5264627be8b38c0f85',
}

export const app = initializeApp(firebaseConfig)

/**
 * `initializeAuth`, never `getAuth` (pulky-game-spec.md §13.6, [HARD-WON]).
 *
 * `getAuth()` installs `browserPopupRedirectResolver` and Auth then awaits it at
 * start-up, loading a cross-origin iframe from `authDomain` before
 * `onAuthStateChanged` can fire. That delays every auth-gated screen and the
 * socket handshake. The resolver is passed only where it is needed:
 * `signInWithPopup(auth, googleProvider, browserPopupRedirectResolver)`.
 */
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
})

export const googleProvider = new GoogleAuthProvider()
