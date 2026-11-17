/** Section 32 - the on-screen movement pad (plan 32 section 3.6, touch controls). */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import MovePad from '../components/game/views/board3d/MovePad'
import type { MoveKey } from '../components/game/views/board3d/playerMotion'

const PAD_BUTTONS: readonly { label: string; key: MoveKey }[] = [
  { label: 'Turn left', key: 'turnLeft' },
  { label: 'Move forward', key: 'forward' },
  { label: 'Turn right', key: 'turnRight' },
  { label: 'Move left', key: 'left' },
  { label: 'Move backward', key: 'back' },
  { label: 'Move right', key: 'right' },
]

function setup() {
  const onMove = vi.fn()
  const utils = render(<MovePad onMove={onMove} />)
  for (const button of screen.getAllByRole('button')) button.setPointerCapture = vi.fn()
  return { onMove, ...utils }
}

const button = (name: string) => screen.getByRole('button', { name })

describe('MovePad', () => {
  it('is a Movement controls group of six labelled buttons, turn and walk on top, strafe and back below', () => {
    setup()
    expect(screen.getByRole('group', { name: 'Movement controls' })).toBeInTheDocument()
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(PAD_BUTTONS.map((b) => b.label))
  })

  it('gives every button a 44-pixel target that the browser does not pan or select', () => {
    setup()
    for (const b of screen.getAllByRole('button')) {
      expect(b.classList.contains('h-11')).toBe(true)
      expect(b.classList.contains('w-11')).toBe(true)
      expect(b.classList.contains('touch-none')).toBe(true)
      expect(b.classList.contains('select-none')).toBe(true)
      expect(b).toHaveAttribute('type', 'button')
    }
  })

  it.each(PAD_BUTTONS.map((b) => [b.label, b.key] as const))(
    '%s: pointer down presses %s, captures the pointer and prevents the default',
    (label, key) => {
      const { onMove } = setup()
      const target = button(label)
      const event = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 7 })
      fireEvent(target, event)
      expect(onMove).toHaveBeenCalledExactlyOnceWith(key, true)
      expect(target.setPointerCapture).toHaveBeenCalledWith(7)
      expect(event.defaultPrevented).toBe(true)
    },
  )

  it.each([
    ['pointer up', (el: HTMLElement) => fireEvent.pointerUp(el, { pointerId: 1 })],
    ['pointer cancel', (el: HTMLElement) => fireEvent.pointerCancel(el, { pointerId: 1 })],
    ['lost pointer capture', (el: HTMLElement) => fireEvent.lostPointerCapture(el, { pointerId: 1 })],
    ['blur', (el: HTMLElement) => fireEvent.blur(el)],
  ])('%s releases the move', (_, end) => {
    const { onMove } = setup()
    const target = button('Turn right')
    fireEvent.pointerDown(target, { pointerId: 1 })
    expect(onMove).toHaveBeenLastCalledWith('turnRight', true)
    end(target)
    expect(onMove).toHaveBeenLastCalledWith('turnRight', false)
  })

  it.each([' ', 'Enter'])('%j held on the keyboard presses until key up', (key) => {
    const { onMove } = setup()
    const target = button('Move backward')
    const prevented = !fireEvent.keyDown(target, { key })
    expect(prevented).toBe(true)
    expect(onMove).toHaveBeenLastCalledWith('back', true)
    fireEvent.keyUp(target, { key })
    expect(onMove).toHaveBeenLastCalledWith('back', false)
  })

  it('ignores other keys going down', () => {
    const { onMove } = setup()
    fireEvent.keyDown(button('Move left'), { key: 'a' })
    expect(onMove).not.toHaveBeenCalled()
  })

  it('blocks the long-press context menu', () => {
    setup()
    expect(fireEvent.contextMenu(button('Move right'))).toBe(false)
  })

  it('lets go of every move when it unmounts', () => {
    const { onMove, unmount } = setup()
    unmount()
    expect(onMove.mock.calls).toEqual(PAD_BUTTONS.map((b) => [b.key, false]))
  })
})
