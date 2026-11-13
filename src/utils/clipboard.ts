import { useGameStore } from '../store/gameStore'

/**
 * Copy `text` and say so with an alert: "Copied." on success, else a hint to copy it
 * by hand (no clipboard API on plain HTTP over a LAN, or permission refused).
 */
export async function copyText(text: string): Promise<void> {
  const addAlert = useGameStore.getState().addAlert
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
    await navigator.clipboard.writeText(text)
    addAlert({ kind: 'info', message: 'Copied.' })
  } catch {
    addAlert({ kind: 'error', message: 'Copy failed. Select the text and copy it.' })
  }
}
