import { UserCheck } from 'lucide-react'
import type { ReactElement } from 'react'
import Badge from '../shared/Badge'

/** The badge only; `ConfigField` decides when it appears (from the field metadata). */
export default function ShownToPlayersBadge(): ReactElement {
  return (
    <Badge tone="shown" icon={UserCheck}>
      Shown to players
    </Badge>
  )
}
