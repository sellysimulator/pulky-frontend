import type { ReactElement } from 'react'
import { Knobs, SectionLayout, type SectionProps } from '../ConfigField'
import { SECTION_PATHS } from '../configDraft'
import { SpoilRiskPreview } from '../ConfigPreviews'

export default function StockSection(props: SectionProps): ReactElement {
  return (
    <SectionLayout
      knobs={<Knobs paths={SECTION_PATHS.stock} {...props} />}
      preview={<SpoilRiskPreview config={props.config} />}
    />
  )
}
