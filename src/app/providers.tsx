import { MantineProvider } from '@mantine/core'
import { DatesProvider } from '@mantine/dates'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import { useEffect, useState, type ReactNode } from 'react'
import { LocalizationProvider, useLocalization } from '../ui/localization/LocalizationContext'
import { bootstrap } from './bootstrap'
import { ServicesContext } from './servicesContext'
import { theme } from './theme'

function LocalizedDates({ children }: { children: ReactNode }) {
  const { locale } = useLocalization()
  useEffect(() => {
    dayjs.locale(locale)
  }, [locale])
  return <DatesProvider settings={{ locale }}>{children}</DatesProvider>
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [services] = useState(bootstrap)

  useEffect(() => {
    void services.settingsRepository.get()
  }, [services])

  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications position="top-center" />
      <ServicesContext.Provider value={services}>
        <LocalizationProvider>
          <LocalizedDates>
            <ModalsProvider>{children}</ModalsProvider>
          </LocalizedDates>
        </LocalizationProvider>
      </ServicesContext.Provider>
    </MantineProvider>
  )
}
