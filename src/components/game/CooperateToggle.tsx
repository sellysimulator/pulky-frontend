import { Handshake } from 'lucide-react'
import type { ReactElement } from 'react'
import InfoTip from '../shared/InfoTip'
import Switch from '../shared/Switch'
import { FormRow } from './OrderSection'

interface CooperateToggleProps {
  checked: boolean
  onChange(checked: boolean): void
  locked: boolean
}

export default function CooperateToggle({ checked, onChange, locked }: CooperateToggleProps): ReactElement {
  return (
    <FormRow
      icon={Handshake}
      label="Equal Supply"
      info={
        <InfoTip label="Equal Supply">
          When every pulquería votes for equal supply, a short supplier fills every order at the same rate. Otherwise the largest
          orders are filled first.
        </InfoTip>
      }
    >
      <Switch checked={checked} onChange={onChange} label="Vote for equal supply" disabled={locked} />
    </FormRow>
  )
}
