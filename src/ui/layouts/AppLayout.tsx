import { AppShell, Container } from '@mantine/core'
import { Outlet } from 'react-router'
import { BottomNav } from '../components/BottomNav'

const FOOTER_HEIGHT = 72

export function AppLayout() {
  return (
    <AppShell footer={{ height: FOOTER_HEIGHT }} padding={0}>
      {/* padding={0} disables AppShell’s built-in footer offset — pad Main explicitly. */}
      <AppShell.Main px={20} pt={16} pb={`calc(${FOOTER_HEIGHT}px + 24px)`}>
        <Container size="sm" px={0}>
          <Outlet />
        </Container>
      </AppShell.Main>

      <AppShell.Footer>
        <BottomNav />
      </AppShell.Footer>
    </AppShell>
  )
}
