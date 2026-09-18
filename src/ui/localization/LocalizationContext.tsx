import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
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
  const t = useMemo(() => bindT(locale), [locale])
  const tPlural = useMemo(() => bindTPlural(locale), [locale])
  const bcp47 = UI_LOCALE_BCP47[locale]
  const value = useMemo(
    (): LocalizationValue => ({
      locale,
      bcp47,
      measurementPreference,
      t,
      tPlural,
    }),
    [locale, bcp47, measurementPreference, t, tPlural],
  )

  useEffect(() => {
    document.documentElement.lang = bcp47
    document.title = t('app.title')
  }, [bcp47, t])

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>
}

export function useLocalization(): LocalizationValue {
  return useContext(LocalizationContext)
}

export type { MessageId }
