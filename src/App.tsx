import { UpdatePrompt } from './infrastructure/pwa/UpdatePrompt'
import { AppProviders } from './app/providers'
import { AppRouter } from './app/router'

export function App() {
  return (
    <AppProviders>
      <AppRouter />
      <UpdatePrompt />
    </AppProviders>
  )
}
