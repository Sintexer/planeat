import type { WeekStartDay } from './LocalDate'

export interface Settings {
  id: 'app-settings'
  householdSize: number
  /** 0 = Sunday … 6 = Saturday. Default Monday. */
  weekStartDay: WeekStartDay
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'app-settings',
  householdSize: 2,
  weekStartDay: 1,
}
