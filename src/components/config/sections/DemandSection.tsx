import type { ReactElement } from 'react'
import { Knobs, SectionLayout, type SectionProps } from '../ConfigField'
import { SECTION_PATHS } from '../configDraft'
import { DemandCapacityPreview, WeekdayPreview } from '../ConfigPreviews'

export default function DemandSection(props: SectionProps): ReactElement {
  return (
    <SectionLayout
      knobs={<Knobs paths={SECTION_PATHS.demand} {...props} />}
      preview={
        <>
          <WeekdayPreview config={props.config} />
          <DemandCapacityPreview config={props.config} />
        </>
      }
    />
  )
}
