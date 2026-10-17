import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  GUEST_ID_KEY,
  clearHostSecret,
  clearSessionToken,
  getDisplayName,
  getGameHostSecret,
  getGuestId,
  getGuestMode,
  getHostSecret,
  getOrCreateGuestId,
  getSessionToken,
  getUiFlag,
  hasPlayedGame,
  markGamePlayed,
  setDisplayName,
  setGameHostSecret,
  setGuestMode,
  setHostSecret,
  setSessionToken,
  setUiFlag,
} from '../utils/storage'
import { LIMITS } from '../types/game'

function keysOf(area: Storage): string[] {
  const keys: string[] = []
  for (let i = 0; i < area.length; i++) {
    const k = area.key(i)
    if (k !== null) keys.push(k)
  }
  return keys
}

function valuesOf(area: Storage): string[] {
  return keysOf(area).map((k) => area.getItem(k) ?? '')
}

describe('guest id', () => {
  it('is null until one is created', () => {
    expect(getGuestId()).toBeNull()
  })

  it('is created as guest_<uuid v4>, persisted in localStorage and stable', () => {
    const id = getOrCreateGuestId()
    expect(id).toMatch(/^guest_[0-9a-f-]{36}$/)
    expect(id).toMatch(/^guest_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(GUEST_ID_KEY).toBe('pulky.guest_id')
    expect(window.localStorage.getItem('pulky.guest_id')).toBe(id)
    expect(window.sessionStorage.getItem('pulky.guest_id')).toBeNull()
    expect(getOrCreateGuestId()).toBe(id)
    expect(getGuestId()).toBe(id)
  })

  it('reuses an id already stored', () => {
    window.localStorage.setItem('pulky.guest_id', 'guest_11111111-1111-4111-8111-111111111111')
    expect(getOrCreateGuestId()).toBe('guest_11111111-1111-4111-8111-111111111111')
  })
})

describe('guest mode', () => {
  it('is off by default and stored as "1" in localStorage', () => {
    expect(getGuestMode()).toBe(false)
    setGuestMode(true)
    expect(getGuestMode()).toBe(true)
    expect(window.localStorage.getItem('pulky.guest_mode')).toBe('1')
    setGuestMode(false)
    expect(getGuestMode()).toBe(false)
    expect(window.localStorage.getItem('pulky.guest_mode')).not.toBe('1')
  })
})

describe('session token (per room, localStorage)', () => {
  it('round-trips under pulky.session_token.<CODE>', () => {
    expect(getSessionToken('ABC234')).toBeNull()
    setSessionToken('ABC234', 'tok-1')
    expect(getSessionToken('ABC234')).toBe('tok-1')
    expect(window.localStorage.getItem('pulky.session_token.ABC234')).toBe('tok-1')
    expect(window.sessionStorage.getItem('pulky.session_token.ABC234')).toBeNull()
  })

  it('upper-cases the room code before it becomes part of the key', () => {
    setSessionToken('abc234', 'tok-1')
    expect(window.localStorage.getItem('pulky.session_token.ABC234')).toBe('tok-1')
    expect(getSessionToken('ABC234')).toBe('tok-1')
    expect(getSessionToken('aBc234')).toBe('tok-1')
    clearSessionToken('abc234')
    expect(getSessionToken('ABC234')).toBeNull()
  })

  it('keeps tokens of different rooms independent; clearing one leaves the other', () => {
    setSessionToken('ABC234', 'tok-a')
    setSessionToken('XYZ789', 'tok-x')
    expect(getSessionToken('ABC234')).toBe('tok-a')
    expect(getSessionToken('XYZ789')).toBe('tok-x')
    clearSessionToken('ABC234')
    expect(getSessionToken('ABC234')).toBeNull()
    expect(getSessionToken('XYZ789')).toBe('tok-x')
    setSessionToken('XYZ789', 'tok-x2')
    expect(getSessionToken('ABC234')).toBeNull()
  })
})

describe('host secret (per room, sessionStorage only)', () => {
  it('round-trips under pulky.host_secret.<CODE> in sessionStorage and never touches localStorage', () => {
    expect(getHostSecret('ABC234')).toBeNull()
    setHostSecret('abc234', 'secret-1')
    expect(getHostSecret('ABC234')).toBe('secret-1')
    expect(window.sessionStorage.getItem('pulky.host_secret.ABC234')).toBe('secret-1')
    expect(valuesOf(window.localStorage)).not.toContain('secret-1')
    expect(keysOf(window.localStorage).filter((k) => k.includes('host_secret'))).toEqual([])
    clearHostSecret('ABC234')
    expect(getHostSecret('ABC234')).toBeNull()
  })

  it('keeps rooms independent', () => {
    setHostSecret('ABC234', 's1')
    setHostSecret('XYZ789', 's2')
    clearHostSecret('ABC234')
    expect(getHostSecret('XYZ789')).toBe('s2')
  })

  it('never lets the two kinds of credential share an area', () => {
    setHostSecret('ABC234', 'the-secret')
    setSessionToken('ABC234', 'the-token')
    expect(valuesOf(window.localStorage)).not.toContain('the-secret')
    expect(valuesOf(window.sessionStorage)).not.toContain('the-token')
  })
})

describe('a finished game (per game id: the room code is reissued)', () => {
  it('keeps the host secret under pulky.game_host_secret.<id> in sessionStorage only', () => {
    expect(getGameHostSecret('9f2c1a')).toBeNull()
    setGameHostSecret('9f2c1a', 'secret-g')
    expect(getGameHostSecret('9f2c1a')).toBe('secret-g')
    expect(window.sessionStorage.getItem('pulky.game_host_secret.9f2c1a')).toBe('secret-g')
    expect(valuesOf(window.localStorage)).not.toContain('secret-g')
    expect(getGameHostSecret('ffff00')).toBeNull()
  })

  it('remembers which games this browser played, per id, in localStorage', () => {
    expect(hasPlayedGame('9f2c1a')).toBe(false)
    markGamePlayed('9f2c1a')
    expect(hasPlayedGame('9f2c1a')).toBe(true)
    expect(window.localStorage.getItem('pulky.played_game.9f2c1a')).toBe('1')
    expect(hasPlayedGame('ffff00')).toBe(false)
  })

  it('never reads the room-code credentials for a game', () => {
    setHostSecret('ABC234', 'room-secret')
    setSessionToken('ABC234', 'room-token')
    expect(getGameHostSecret('ABC234')).toBeNull()
    expect(hasPlayedGame('ABC234')).toBe(false)
  })
})

describe('display name (spec 3.4)', () => {
  it('is null until set and stored in localStorage', () => {
    expect(getDisplayName()).toBeNull()
    setDisplayName('Ana')
    expect(getDisplayName()).toBe('Ana')
    expect(window.localStorage.getItem('pulky.display_name')).toBe('Ana')
  })

  it('turns a tab into a space instead of joining the words', () => {
    setDisplayName('Don\tAgave')
    expect(getDisplayName()).toBe('Don Agave')
  })

  it('turns every whitespace control character into a space', () => {
    setDisplayName('a\nb\rc\td')
    expect(getDisplayName()).toBe('a b c d')
  })

  it('removes other control characters without leaving a space', () => {
    setDisplayName('Don\u0007Agave')
    expect(getDisplayName()).toBe('DonAgave')
    setDisplayName('Ana\u0000')
    expect(getDisplayName()).toBe('Ana')
  })

  it('collapses runs of whitespace and trims', () => {
    setDisplayName('   Don    Agave   ')
    expect(getDisplayName()).toBe('Don Agave')
  })

  it('clamps to MAX_DISPLAY_NAME and trims again', () => {
    expect(LIMITS.MAX_DISPLAY_NAME).toBe(24)
    setDisplayName('x'.repeat(40))
    expect(getDisplayName()).toBe('x'.repeat(24))
    setDisplayName('a'.repeat(23) + ' bcd')
    expect(getDisplayName()).toBe('a'.repeat(23))
  })

  it('clears the stored name when nothing is left after sanitising', () => {
    setDisplayName('Ana')
    setDisplayName('  \u0007\t ')
    expect(getDisplayName()).toBeNull()
    setDisplayName('Ana')
    setDisplayName('')
    expect(getDisplayName()).toBeNull()
  })
})

describe('ui flags', () => {
  it('default to false and round-trip', () => {
    expect(getUiFlag('details_open')).toBe(false)
    setUiFlag('details_open', true)
    expect(getUiFlag('details_open')).toBe(true)
    expect(window.localStorage.getItem('pulky.ui.details_open')).not.toBeNull()
    setUiFlag('details_open', false)
    expect(getUiFlag('details_open')).toBe(false)
  })
})

describe('a throwing storage (private mode)', () => {
  const names = ['localStorage', 'sessionStorage'] as const
  const saved = new Map<string, PropertyDescriptor | undefined>()

  function breakStorage(kind: 'accessor' | 'methods'): void {
    const broken = {
      length: 0,
      key: () => {
        throw new Error('denied')
      },
      clear: () => {
        throw new Error('denied')
      },
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
      removeItem: () => {
        throw new Error('denied')
      },
    }
    for (const name of names) {
      for (const target of new Set<object>([window, globalThis])) {
        const id = `${name}:${target === window ? 'window' : 'global'}`
        if (!saved.has(id)) saved.set(id, Object.getOwnPropertyDescriptor(target, name))
        if (kind === 'accessor') {
          Object.defineProperty(target, name, {
            configurable: true,
            get() {
              throw new Error('SecurityError')
            },
          })
        } else {
          Object.defineProperty(target, name, { configurable: true, value: broken, writable: true })
        }
      }
    }
  }

  afterEach(() => {
    for (const name of names) {
      for (const target of new Set<object>([window, globalThis])) {
        const id = `${name}:${target === window ? 'window' : 'global'}`
        const original = saved.get(id)
        if (original) Object.defineProperty(target, name, original)
        else Reflect.deleteProperty(target, name)
      }
    }
    saved.clear()
  })

  it.each(['accessor', 'methods'] as const)('reads give null/false and writes are no-ops (%s)', (kind) => {
    breakStorage(kind)
    expect(getGuestId()).toBeNull()
    expect(getGuestMode()).toBe(false)
    expect(getSessionToken('ABC234')).toBeNull()
    expect(getHostSecret('ABC234')).toBeNull()
    expect(getDisplayName()).toBeNull()
    expect(getUiFlag('details_open')).toBe(false)
    expect(() => setGuestMode(true)).not.toThrow()
    expect(() => setSessionToken('ABC234', 't')).not.toThrow()
    expect(() => clearSessionToken('ABC234')).not.toThrow()
    expect(() => setHostSecret('ABC234', 's')).not.toThrow()
    expect(() => clearHostSecret('ABC234')).not.toThrow()
    expect(() => setDisplayName('Ana')).not.toThrow()
    expect(() => setUiFlag('details_open', true)).not.toThrow()
    expect(getSessionToken('ABC234')).toBeNull()
    expect(getUiFlag('details_open')).toBe(false)
  })
})

describe('storage.ts is the only module that touches Web Storage', () => {
  const srcRoot = resolve(process.cwd(), 'src')

  function walk(dir: string): string[] {
    const out: string[] = []
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        if (entry === '__tests__') continue
        out.push(...walk(full))
      } else if (/\.(ts|tsx)$/.test(entry)) {
        out.push(full)
      }
    }
    return out
  }

  function code(file: string): string {
    return readFileSync(file, 'utf8')
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
      .join('\n')
  }

  it('is the only file under src/ (tests excluded) that names localStorage or sessionStorage', () => {
    const offenders = walk(srcRoot)
      .filter((f) => /\b(localStorage|sessionStorage)\b/.test(code(f)))
      .map((f) => relative(srcRoot, f).split('\\').join('/'))
    expect(offenders).toEqual(['utils/storage.ts'])
  })
})
