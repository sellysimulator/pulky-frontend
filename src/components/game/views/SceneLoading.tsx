import type { ReactElement } from 'react'
import LoadingSpinner from '../../shared/LoadingSpinner'
import { usePhoneViewport } from './board3d/phoneViewport'

/**
 * The loading card over the board's area: while the chunk loads, and until the scene inside the canvas has loaded. It
 * covers a phone's whole screen, as the board does, so the header does not come and go.
 */
export default function SceneLoading(): ReactElement {
  const phone = usePhoneViewport()
  return (
    <div
      data-phone-scene={phone || undefined}
      className={`fixed ${phone ? 'inset-0' : 'inset-x-0 top-14 bottom-0'} z-10 grid place-items-center bg-canvas`}
    >
      <div className="rounded-lg border border-border bg-card p-8 shadow-card">
        <LoadingSpinner label="Building your pulquería" size={24} />
      </div>
    </div>
  )
}
