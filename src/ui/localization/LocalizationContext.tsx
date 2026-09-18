import { createContext, useContext, useEffect, type ReactNode } from 'react'
import {
  DEFAULT_MEASUREMENT_PREFERENCE,
  DEFAULT_UI_LOCALE,
  UI_LOCALE_BCP47,
  type MeasurementPreference,
  type UiLocale,
} from '../../domain/shared/Locale'
import { useSettings } from '../hooks/useSettings'
import { bindT, bindTPlural, type MessageId, type Translate, type TranslatePlural } from './t'

interface LocalizationValue {
  locale: UiLocale
  bcp47: string
  measurementPreference: MeasurementPreference
  t: Translate
  tPlural: TranslatePlural
}

const defaultT = bindT(DEFAULT_UI_LOCALE)
const defaultPlural = bindTPlural(DEFAULT_UI_LOCALE)

const LocalizationContext = createContext<LocalizationValue>({
  locale: DEFAULT_UI_LOCALE,
  bcp47: UI_LOCALE_BCP47[DEFAULT_UI_LOCALE],
  measurementPreference: DEFAULT_MEASUREMENT_PREFERENCE,
  t: defaultT,
  tPlural: defaultPlural,
})

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const settings = useSettings()
  const locale = settings?.uiLocale ?? DEFAULT_UI_LOCALE
  const measurementPreference = settings?.measurementPreference ?? DEFAULT_MEASUREMENT_PREFERENCE
  const t = bindT(locale)
  const value: LocalizationValue = {
    locale,
    bcp47: UI_LOCALE_BCP47[locale],
    measurementPreference,
    t,
    tPlural: bindTPlural(locale),
  }

  useEffect(() => {
    document.documentElement.lang = UI_LOCALE_BCP47[locale]
    document.title = t('app.title')
  }, [locale, t])

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>
}

export function useLocalization(): LocalizationValue {
  return useContext(LocalizationContext)
}

export type { MessageId }
