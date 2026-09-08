import { AppShell, Group, Text, ActionIcon, Container } from '@mantine/core'
import { IconSettings } from '@tabler/icons-react'
import { Outlet, useNavigate } from 'react-router'
import { BottomNav } from '../components/BottomNav'

export function AppLayout() {
  const navigate = useNavigate()

  return (
    <AppShell header={{ height: 56 }} footer={{ height: 64 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Text fw={700}>Family Menu Planner</Text>
          <ActionIcon variant="subtle" aria-label="Settings" onClick={() => navigate('/settings')}>
            <IconSettings size={22} />
          </ActionIcon>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
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
