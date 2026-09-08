import { createContext, useContext } from 'react'
import type { AppServices } from './bootstrap'

export const ServicesContext = createContext<AppServices | undefined>(undefined)

export function useServices(): AppServices {
  const services = useContext(ServicesContext)
  if (!services) throw new Error('useServices must be used within <AppProviders>')
  return services
}
