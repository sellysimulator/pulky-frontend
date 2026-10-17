/**
 * The only module that touches Web Storage (spec §13.6). Every accessor
 * survives a throwing storage (private mode): reads return null/false and
 * writes are no-ops.
 */
import { v4 as uuidv4 } from 'uuid'
import { LIMITS } from '../types/game'

export const GUEST_ID_KEY = 'pulky.guest_id'

const GUEST_MODE_KEY = 'pulky.guest_mode'
const DISPLAY_NAME_KEY = 'pulky.display_name'
const GUEST_ID_RE = /^guest_[0-9a-f-]{36}$/

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocal(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function removeLocal(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // storage unavailable: nothing to remove
  }
}

function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeSession(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    // storage unavailable: the value is simply not kept
  }
}

function removeSession(key: string): void {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // storage unavailable: nothing to remove
  }
}

function sessionTokenKey(roomCode: string): string {
  return `pulky.session_token.${roomCode.toUpperCase()}`
}

function hostSecretKey(roomCode: string): string {
  return `pulky.host_secret.${roomCode.toUpperCase()}`
}

function gameHostSecretKey(gameId: string): string {
  return `pulky.game_host_secret.${gameId}`
}

function playedGameKey(gameId: string): string {
  return `pulky.played_game.${gameId}`
}

// ---------------------------------------------------------------- guest id

let unsavedGuestId: string | null = null

export function getGuestId(): string | null {
  return readLocal(GUEST_ID_KEY)
}

export function getOrCreateGuestId(): string {
  const stored = getGuestId()
  if (stored !== null && GUEST_ID_RE.test(stored)) return stored
  const id = unsavedGuestId ?? `guest_${uuidv4()}`
  if (writeLocal(GUEST_ID_KEY, id)) {
    unsavedGuestId = null
    return id
  }
  unsavedGuestId = id
  return id
}

export function getGuestMode(): boolean {
  return readLocal(GUEST_MODE_KEY) === '1'
}

export function setGuestMode(on: boolean): void {
  if (on) writeLocal(GUEST_MODE_KEY, '1')
  else removeLocal(GUEST_MODE_KEY)
}

// ---------------------------------------------------------------- room credentials

export function getSessionToken(roomCode: string): string | null {
  return readLocal(sessionTokenKey(roomCode))
}

export function setSessionToken(roomCode: string, token: string): void {
  writeLocal(sessionTokenKey(roomCode), token)
}

export function clearSessionToken(roomCode: string): void {
  removeLocal(sessionTokenKey(roomCode))
}

export function getHostSecret(roomCode: string): string | null {
  return readSession(hostSecretKey(roomCode))
}

export function setHostSecret(roomCode: string, secret: string): void {
  writeSession(hostSecretKey(roomCode), secret)
}

export function clearHostSecret(roomCode: string): void {
  removeSession(hostSecretKey(roomCode))
}

// ---------------------------------------------------------------- finished games
// A room code is reissued once its room expires, so after the end everything is
// keyed by the game id that `game_finished` carries (spec §11.3).

/** The live room's host secret, copied for this game when it finished in this tab. */
export function getGameHostSecret(gameId: string): string | null {
  return readSession(gameHostSecretKey(gameId))
}

export function setGameHostSecret(gameId: string, secret: string): void {
  writeSession(gameHostSecretKey(gameId), secret)
}

/** Whether this browser held a seat in that game. */
export function hasPlayedGame(gameId: string): boolean {
  return readLocal(playedGameKey(gameId)) === '1'
}

export function markGamePlayed(gameId: string): void {
  writeLocal(playedGameKey(gameId), '1')
}

// ---------------------------------------------------------------- display name

export function getDisplayName(): string | null {
  const name = readLocal(DISPLAY_NAME_KEY)
  return name === null || name === '' ? null : name
}

function sanitiseDisplayName(raw: string): string {
  const cleaned = raw
    .replace(/[\t\n\v\f\r]/g, ' ')
    .replace(/\p{Cc}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
  return Array.from(cleaned).slice(0, LIMITS.MAX_DISPLAY_NAME).join('').trim()
}

export function setDisplayName(name: string): void {
  const clean = sanitiseDisplayName(name)
  if (clean === '') removeLocal(DISPLAY_NAME_KEY)
  else writeLocal(DISPLAY_NAME_KEY, clean)
}

// ---------------------------------------------------------------- UI flags

export type UiFlag = 'details_open'

export function getUiFlag(flag: UiFlag): boolean {
  return readLocal(`pulky.ui.${flag}`) === '1'
}

export function setUiFlag(flag: UiFlag, value: boolean): void {
  writeLocal(`pulky.ui.${flag}`, value ? '1' : '0')
}
