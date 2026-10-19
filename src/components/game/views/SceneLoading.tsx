import type { ReactElement } from 'react'
import LoadingSpinner from '../../shared/LoadingSpinner'

/** The loading card over the board's area: while the chunk loads, and until the scene inside the canvas has loaded. */
export default function SceneLoading(): ReactElement {
  return (
    <div className="fixed inset-x-0 top-14 bottom-0 z-10 grid place-items-center bg-canvas">
      <div className="rounded-lg border border-border bg-card p-8 shadow-card">
        <LoadingSpinner label="Building your pulquería" size={24} />
      </div>
    </div>
  )
}
