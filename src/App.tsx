import { LocalizedUpdatePrompt } from './app/LocalizedUpdatePrompt'
import { AppProviders } from './app/providers'
import { AppRouter } from './app/router'

export function App() {
  return (
    <AppProviders>
      <AppRouter />
      <LocalizedUpdatePrompt />
    </AppProviders>
  )
}
