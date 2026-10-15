import type { ReactElement } from 'react'
import { Knobs, SectionLayout, type SectionProps } from '../ConfigField'
import { SECTION_PATHS } from '../configDraft'
import { DemandSplitPreview } from '../ConfigPreviews'

export default function ReputationSection(props: SectionProps): ReactElement {
  return (
    <SectionLayout
      knobs={<Knobs paths={SECTION_PATHS.reputation} {...props} />}
      preview={<DemandSplitPreview config={props.config} />}
    />
  )
}
