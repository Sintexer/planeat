import { MantineProvider } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import { useEffect, useState, type ReactNode } from 'react'
import { LocalizationProvider } from '../ui/localization/LocalizationContext'
import { bootstrap } from './bootstrap'
import { ServicesContext } from './servicesContext'
import { theme } from './theme'

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
          <ModalsProvider>{children}</ModalsProvider>
        </LocalizationProvider>
      </ServicesContext.Provider>
    </MantineProvider>
  )
}
