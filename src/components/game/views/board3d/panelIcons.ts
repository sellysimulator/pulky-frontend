import { CalendarDays, ChartLine, ChartPie, ClipboardList, History, Warehouse, type LucideIcon } from 'lucide-react'
import type { PanelId } from './sceneLayout'

/** The icon of each panel, on the panel bar and on the phone's dock. */
export const PANEL_ICONS: Record<PanelId, LucideIcon> = {
  'day-stats': CalendarDays,
  yesterday: History,
  decision: ClipboardList,
  cellar: Warehouse,
  market: ChartPie,
  details: ChartLine,
}
