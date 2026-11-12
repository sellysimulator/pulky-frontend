import { describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase', () => ({ auth: { currentUser: null }, googleProvider: {}, app: {} }))

import { errorMessage } from '../api/http'

const wire = (detail: unknown) => ({ response: { data: { detail } } })

describe('errorMessage (spec 13.6)', () => {
  it('joins the msg of every item of a 422 array with "; "', () => {
    expect(errorMessage(wire([{ msg: 'a' }, { msg: 'b' }]), 'x')).toBe('a; b')
  })

  it('returns a string detail as is', () => {
    expect(errorMessage(wire('Room not found.'), 'x')).toBe('Room not found.')
  })

  it('falls back for an Error without a response', () => {
    expect(errorMessage(new Error('boom'), 'Could not create the room.')).toBe(
      'Could not create the room.',
    )
  })

  it('falls back for a blank string detail', () => {
    expect(errorMessage(wire('   '), 'fallback')).toBe('fallback')
    expect(errorMessage(wire(''), 'fallback')).toBe('fallback')
  })

  it('skips array items without a string msg and falls back when none is left', () => {
    expect(errorMessage(wire([{ msg: 'a' }, { loc: ['body'] }, { msg: 42 }, null]), 'x')).toBe('a')
    expect(errorMessage(wire([{ loc: ['body'] }, { msg: 7 }]), 'fallback')).toBe('fallback')
    expect(errorMessage(wire([]), 'fallback')).toBe('fallback')
  })

  it('falls back for a detail that is an object, a number or missing', () => {
    expect(errorMessage(wire({ msg: 'nested' }), 'fallback')).toBe('fallback')
    expect(errorMessage(wire(404), 'fallback')).toBe('fallback')
    expect(errorMessage({ response: { data: {} } }, 'fallback')).toBe('fallback')
    expect(errorMessage({ response: {} }, 'fallback')).toBe('fallback')
  })

  it('never throws and falls back for null, undefined and primitives', () => {
    for (const bad of [null, undefined, 'oops', 7, {}, []]) {
      expect(errorMessage(bad, 'fallback')).toBe('fallback')
    }
  })

  it('says a room gone (expired or never there) in the player\'s words', () => {
    expect(errorMessage(wire('No room with that code.'), 'x')).toBe('This room has expired or does not exist.')
  })

  it('always returns a string, never the 422 array or an object (React child crash)', () => {
    const inputs: unknown[] = [
      wire([{ msg: 'a' }, { msg: 'b' }]),
      wire([{ type: 'missing', loc: ['body', 'x'], msg: 'Field required' }]),
      wire([{ loc: ['body'] }]),
      wire({ msg: 'object detail' }),
      wire('text'),
      new Error('boom'),
      null,
    ]
    for (const input of inputs) {
      const out = errorMessage(input, 'fallback')
      expect(typeof out).toBe('string')
      expect(out.length).toBeGreaterThan(0)
    }
  })
})

describe('errorMessage: the abuse limits (spec 0.6, 13.4)', () => {
  const refused = (status: number, detail: unknown, headers: unknown = {}) => ({
    response: { status, headers, data: { detail } },
  })
  const SERVER_429 = 'Too many requests. Wait a minute and try again.'

  it('429 names the wait from Retry-After', () => {
    expect(errorMessage(refused(429, SERVER_429, { 'retry-after': '60' }), 'x')).toBe(
      'Too many requests from your network. Please wait about 60 seconds and try again.',
    )
  })

  it('429 reads Retry-After through AxiosHeaders.get too', () => {
    const headers = { get: (name: string) => (name === 'retry-after' ? '30' : undefined) }
    expect(errorMessage(refused(429, SERVER_429, headers), 'x')).toBe(
      'Too many requests from your network. Please wait about 30 seconds and try again.',
    )
  })

  it('429 without a usable Retry-After (hidden by CORS, missing or a date) says a minute', () => {
    const minute = 'Too many requests from your network. Please wait a minute and try again.'
    expect(errorMessage(refused(429, SERVER_429), 'x')).toBe(minute)
    expect(errorMessage(refused(429, SERVER_429, undefined), 'x')).toBe(minute)
    expect(errorMessage(refused(429, SERVER_429, { 'retry-after': 'Wed, 21 Oct 2026 07:28:00 GMT' }), 'x')).toBe(minute)
  })

  it('413 says the request was too large', () => {
    expect(errorMessage(refused(413, 'That request is too large.'), 'x')).toBe('That request was too large.')
  })

  it('503 at the live-room cap (TOO_MANY_ROOMS) says too many games are running', () => {
    expect(
      errorMessage(refused(503, 'Too many games are open right now. Try again in a few minutes.'), 'x'),
    ).toBe('Too many games are running right now — please try again in a few minutes.')
  })

  it('503 without a detail (a proxy page) says the server is busy; one with its own detail keeps it', () => {
    expect(errorMessage(refused(503, undefined), 'x')).toBe(
      'The server is busy right now — please try again in a minute.',
    )
    expect(errorMessage(refused(503, 'Sign-in is not available right now.'), 'x')).toBe(
      'Sign-in is not available right now.',
    )
  })
})
