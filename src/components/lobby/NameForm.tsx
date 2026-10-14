import { useId, useState, type FormEvent, type ReactElement } from 'react'
import { LIMITS } from '../../types/game'
import { getDisplayName } from '../../utils/storage'
import Button from '../shared/Button'

interface NameFormProps {
  onSubmit(name: string): void
  pending?: boolean
}

export default function NameForm({ onSubmit, pending = false }: NameFormProps): ReactElement {
  const id = useId()
  const [name, setName] = useState<string>(() => getDisplayName() ?? '')
  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault()
    if (pending) return
    onSubmit(name)
  }
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-base font-medium">
          Your pulquería&apos;s name
        </label>
        <input
          id={id}
          type="text"
          autoComplete="off"
          maxLength={LIMITS.MAX_DISPLAY_NAME}
          placeholder="Pulquería P1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-11 rounded-md border border-border-control bg-card px-3 text-lg font-medium text-ink outline-none hover:border-ink-subtle focus-visible:border-accent"
        />
      </div>
      <Button type="submit" variant="primary" size="lg" loading={pending}>
        Take a seat
      </Button>
    </form>
  )
}
