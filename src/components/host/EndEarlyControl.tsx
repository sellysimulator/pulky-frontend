import { Flag } from 'lucide-react'
import { useState, type ReactElement } from 'react'
import Button from '../shared/Button'
import ConfirmDialog from '../shared/ConfirmDialog'

interface EndEarlyControlProps {
  onConfirm(): void
  disabled?: boolean
}

/** The destructive trigger plus its confirm dialog; `onConfirm` fires once, only after the confirm click (spec §11.4). */
export default function EndEarlyControl({ onConfirm, disabled = false }: EndEarlyControlProps): ReactElement {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="destructive" icon={Flag} disabled={disabled} onClick={() => setOpen(true)}>
        End game early
      </Button>
      <ConfirmDialog
        open={open}
        title="End the game for everyone?"
        body="The game ends now for every pulquería and their stock is settled. This cannot be undone."
        confirmLabel="End game"
        cancelLabel="Cancel"
        onConfirm={() => {
          setOpen(false)
          onConfirm()
        }}
        onCancel={() => setOpen(false)}
      />
    </>
  )
}
