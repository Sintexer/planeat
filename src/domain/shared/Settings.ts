import {
  DEFAULT_MEASUREMENT_PREFERENCE,
  DEFAULT_UI_LOCALE,
  parseMeasurementPreference,
  parseUiLocale,
  type MeasurementPreference,
  type UiLocale,
} from './Locale'
import type { WeekStartDay } from './LocalDate'

export interface Settings {
  id: 'app-settings'
  householdSize: number
  /** 0 = Sunday … 6 = Saturday. Default Monday. */
  weekStartDay: WeekStartDay
  /** Half-unit steps. Default 2. */
  maxBatchPrepUnits: number
  /** Preferred weekdays for batch prep (0–6). Empty = no preference. */
  preferredBatchPrepDays: WeekStartDay[]
  /** Weekdays where only quick prep is preferred. */
  quickMealsOnlyDays: WeekStartDay[]
  avoidMultipleDemandingPreps: boolean
  favorVegetablesDaily: boolean
  uiLocale: UiLocale
  measurementPreference: MeasurementPreference
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'app-settings',
  householdSize: 2,
  weekStartDay: 1,
  maxBatchPrepUnits: 2,
  preferredBatchPrepDays: [],
  quickMealsOnlyDays: [],
  avoidMultipleDemandingPreps: true,
  favorVegetablesDaily: false,
  uiLocale: DEFAULT_UI_LOCALE,
  measurementPreference: DEFAULT_MEASUREMENT_PREFERENCE,
}

/** Merge missing planning-preference fields onto a stored settings row. */
export function mergeSettingsDefaults(row: Partial<Settings> & { id: 'app-settings' }): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...row,
    preferredBatchPrepDays: row.preferredBatchPrepDays ?? DEFAULT_SETTINGS.preferredBatchPrepDays,
    quickMealsOnlyDays: row.quickMealsOnlyDays ?? DEFAULT_SETTINGS.quickMealsOnlyDays,
    maxBatchPrepUnits:
      typeof row.maxBatchPrepUnits === 'number'
        ? row.maxBatchPrepUnits
        : DEFAULT_SETTINGS.maxBatchPrepUnits,
    avoidMultipleDemandingPreps:
      typeof row.avoidMultipleDemandingPreps === 'boolean'
        ? row.avoidMultipleDemandingPreps
        : DEFAULT_SETTINGS.avoidMultipleDemandingPreps,
    favorVegetablesDaily:
      typeof row.favorVegetablesDaily === 'boolean'
        ? row.favorVegetablesDaily
        : DEFAULT_SETTINGS.favorVegetablesDaily,
    weekStartDay:
      typeof row.weekStartDay === 'number' ? row.weekStartDay : DEFAULT_SETTINGS.weekStartDay,
    householdSize:
      typeof row.householdSize === 'number' ? row.householdSize : DEFAULT_SETTINGS.householdSize,
    uiLocale: parseUiLocale(row.uiLocale),
    measurementPreference: parseMeasurementPreference(row.measurementPreference),
  }
}
