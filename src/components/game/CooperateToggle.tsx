import { Handshake } from 'lucide-react'
import type { ReactElement } from 'react'
import Switch from '../shared/Switch'
import { FormRow } from './OrderSection'

interface CooperateToggleProps {
  checked: boolean
  onChange(checked: boolean): void
  locked: boolean
}

export default function CooperateToggle({ checked, onChange, locked }: CooperateToggleProps): ReactElement {
  return (
    <FormRow icon={Handshake}>
      <Switch checked={checked} onChange={onChange} label="Cooperate on allocation" disabled={locked} />
    </FormRow>
  )
}
