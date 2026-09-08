import { UnstyledButton, Stack, Text, Group } from '@mantine/core'
import {
  IconToolsKitchen2,
  IconCalendarWeek,
  IconListCheck,
  IconBook2,
  type Icon,
} from '@tabler/icons-react'
import { NavLink } from 'react-router'

interface NavItem {
  to: string
  label: string
  icon: Icon
}

const NAV_ITEMS: NavItem[] = [
  { to: '/today', label: 'Today', icon: IconToolsKitchen2 },
  { to: '/week', label: 'Week', icon: IconCalendarWeek },
  { to: '/lists', label: 'Lists', icon: IconListCheck },
  { to: '/recipes', label: 'Recipes', icon: IconBook2 },
]

export function BottomNav() {
  return (
    <Group h="100%" grow gap={0} px="xs">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} style={{ textDecoration: 'none', width: '100%' }}>
          {({ isActive }) => (
            <UnstyledButton
              w="100%"
              py={6}
              c={isActive ? 'green' : 'dimmed'}
              style={{ minHeight: 44 }}
            >
              <Stack align="center" gap={2}>
                <Icon size={22} />
                <Text size="xs">{label}</Text>
              </Stack>
            </UnstyledButton>
          )}
        </NavLink>
      ))}
    </Group>
  )
}
