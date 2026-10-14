import type { ReactElement } from 'react'
import { Knobs, type SectionProps } from '../ConfigField'
import { SECTION_PATHS } from '../configDraft'

export default function PeerMarketSection(props: SectionProps): ReactElement {
  return <Knobs paths={SECTION_PATHS.peer} {...props} />
}
