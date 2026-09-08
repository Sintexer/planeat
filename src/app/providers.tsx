import { MantineProvider } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import { useState, type ReactNode } from 'react'
import { bootstrap } from './bootstrap'
import { ServicesContext } from './servicesContext'
import { theme } from './theme'

export function AppProviders({ children }: { children: ReactNode }) {
  const [services] = useState(bootstrap)

  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications position="top-center" />
      <ModalsProvider>
        <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>
      </ModalsProvider>
    </MantineProvider>
  )
}
