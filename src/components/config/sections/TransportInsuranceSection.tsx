import type { ReactElement } from 'react'
import { Knobs, type SectionProps } from '../ConfigField'
import { SECTION_PATHS } from '../configDraft'
import InsuranceCalculator from '../InsuranceCalculator'

export default function TransportInsuranceSection(props: SectionProps): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <Knobs paths={SECTION_PATHS.transport} {...props} />
      <InsuranceCalculator config={props.config} onChange={props.onPatch} readOnly={props.readOnly} issues={props.insuranceIssues} />
    </div>
  )
}
