export const UI_LOCALES = ['en', 'ru'] as const
export type UiLocale = (typeof UI_LOCALES)[number]

export const MEASUREMENT_PREFERENCES = ['as-entered', 'metric', 'us-customary'] as const
export type MeasurementPreference = (typeof MEASUREMENT_PREFERENCES)[number]

export const DEFAULT_UI_LOCALE: UiLocale = 'en'
export const DEFAULT_MEASUREMENT_PREFERENCE: MeasurementPreference = 'as-entered'

export const UI_LOCALE_BCP47: Record<UiLocale, string> = {
  en: 'en',
  ru: 'ru',
}

export const UI_LOCALE_ENDONYMS: Record<UiLocale, string> = {
  en: 'English',
  ru: 'Русский',
}

export function parseUiLocale(value: unknown): UiLocale {
  if (value === 'en' || value === 'ru') return value
  return DEFAULT_UI_LOCALE
}

export function parseMeasurementPreference(value: unknown): MeasurementPreference {
  if (value === 'as-entered' || value === 'metric' || value === 'us-customary') return value
  return DEFAULT_MEASUREMENT_PREFERENCE
}
