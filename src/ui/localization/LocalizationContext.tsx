import { createContext, useContext, type ReactNode } from 'react'
import {
  DEFAULT_MEASUREMENT_PREFERENCE,
  DEFAULT_UI_LOCALE,
  UI_LOCALE_BCP47,
  type MeasurementPreference,
  type UiLocale,
} from '../../domain/shared/Locale'
import { useSettings } from '../hooks/useSettings'
import { t as translate, type MessageId } from './t'

interface LocalizationValue {
  locale: UiLocale
  bcp47: string
  measurementPreference: MeasurementPreference
  t: (id: MessageId) => string
}

const LocalizationContext = createContext<LocalizationValue>({
  locale: DEFAULT_UI_LOCALE,
  bcp47: UI_LOCALE_BCP47[DEFAULT_UI_LOCALE],
  measurementPreference: DEFAULT_MEASUREMENT_PREFERENCE,
  t: (id) => translate(DEFAULT_UI_LOCALE, id),
})

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const settings = useSettings()
  const locale = settings?.uiLocale ?? DEFAULT_UI_LOCALE
  const measurementPreference = settings?.measurementPreference ?? DEFAULT_MEASUREMENT_PREFERENCE
  const value: LocalizationValue = {
    locale,
    bcp47: UI_LOCALE_BCP47[locale],
    measurementPreference,
    t: (id) => translate(locale, id),
  }
  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>
}

export function useLocalization(): LocalizationValue {
  return useContext(LocalizationContext)
}
