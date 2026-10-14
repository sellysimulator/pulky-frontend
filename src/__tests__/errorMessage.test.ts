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
