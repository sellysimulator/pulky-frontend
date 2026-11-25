/** The walk joystick of a phone (spec §13.11.6, touch controls). */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Joystick from '../components/game/views/board3d/Joystick'

/** The base is 112px across, centred on (56, 56). */
function setup() {
  const onMove = vi.fn()
  const utils = render(<Joystick onMove={onMove} />)
  const stick = screen.getByRole('group', { name: 'Movement joystick' })
  stick.getBoundingClientRect = () => new DOMRect(0, 0, 112, 112)
  stick.setPointerCapture = vi.fn()
  return { onMove, stick, knob: stick.firstElementChild as HTMLElement, ...utils }
}

const UP = { clientX: 56, clientY: 10 }
const UP_RIGHT = { clientX: 96, clientY: 16 }
const RIGHT = { clientX: 106, clientY: 56 }
const CENTRE = { clientX: 58, clientY: 58 }

describe('Joystick', () => {
  it('a push presses its move, captures the pointer and prevents the default', () => {
    const { onMove, stick } = setup()
    const event = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 7, ...UP })
    fireEvent(stick, event)
    expect(onMove).toHaveBeenCalledExactlyOnceWith('forward', true)
    expect(stick.setPointerCapture).toHaveBeenCalledWith(7)
    expect(event.defaultPrevented).toBe(true)
  })

  it('sliding to another direction lets go of the moves it leaves and keeps the ones it shares', () => {
    const { onMove, stick } = setup()
    fireEvent.pointerDown(stick, { pointerId: 1, ...UP })
    fireEvent.pointerMove(stick, { pointerId: 1, ...UP_RIGHT })
    fireEvent.pointerMove(stick, { pointerId: 1, ...RIGHT })
    expect(onMove.mock.calls).toEqual([
      ['forward', true],
      ['right', true],
      ['forward', false],
    ])
  })

  it('a thumb back in the dead zone stands still', () => {
    const { onMove, stick } = setup()
    fireEvent.pointerDown(stick, { pointerId: 1, ...UP })
    fireEvent.pointerMove(stick, { pointerId: 1, ...CENTRE })
    expect(onMove).toHaveBeenLastCalledWith('forward', false)
  })

  it.each([
    ['pointer up', (el: HTMLElement) => fireEvent.pointerUp(el, { pointerId: 1 })],
    ['pointer cancel', (el: HTMLElement) => fireEvent.pointerCancel(el, { pointerId: 1 })],
    ['lost pointer capture', (el: HTMLElement) => fireEvent.lostPointerCapture(el, { pointerId: 1 })],
  ])('%s releases every move and centres the knob', (_, end) => {
    const { onMove, stick, knob } = setup()
    fireEvent.pointerDown(stick, { pointerId: 1, ...UP_RIGHT })
    expect(knob.style.transform).not.toBe('translate(0px, 0px)')
    onMove.mockClear()
    end(stick)
    expect(onMove.mock.calls).toEqual([
      ['forward', false],
      ['right', false],
    ])
    expect(knob.style.transform).toBe('translate(0px, 0px)')
  })

  it('lets go when it unmounts (a panel opens)', () => {
    const { onMove, stick, unmount } = setup()
    fireEvent.pointerDown(stick, { pointerId: 1, ...RIGHT })
    unmount()
    expect(onMove).toHaveBeenLastCalledWith('right', false)
  })

  it('listens to one pointer at a time', () => {
    const { onMove, stick } = setup()
    fireEvent.pointerDown(stick, { pointerId: 1, ...UP })
    fireEvent.pointerDown(stick, { pointerId: 2, ...RIGHT })
    fireEvent.pointerMove(stick, { pointerId: 2, ...RIGHT })
    fireEvent.pointerUp(stick, { pointerId: 2 })
    expect(onMove.mock.calls).toEqual([['forward', true]])
  })

  it('stops the knob short of the edge, however far the thumb goes', () => {
    const { stick, knob } = setup()
    fireEvent.pointerDown(stick, { pointerId: 1, clientX: 556, clientY: 56 })
    expect(knob.style.transform).toBe('translate(34px, 0px)')
  })

  it('the browser does not pan, select or open a menu under the thumb', () => {
    const { stick } = setup()
    expect(stick).toHaveClass('touch-none', 'select-none')
    expect(fireEvent.contextMenu(stick)).toBe(false)
  })
})
