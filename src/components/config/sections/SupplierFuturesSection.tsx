import type { ReactElement } from 'react'
import { Knobs, SectionLayout, type SectionProps } from '../ConfigField'
import { SECTION_PATHS } from '../configDraft'
import { SpotRangePreview } from '../ConfigPreviews'

export default function SupplierFuturesSection(props: SectionProps): ReactElement {
  return (
    <SectionLayout
      knobs={<Knobs paths={SECTION_PATHS.supplier} {...props} />}
      preview={<SpotRangePreview config={props.config} />}
    />
  )
}
