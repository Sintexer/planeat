import { UnstyledButton, Stack, Text, Group } from '@mantine/core'
import {
  IconCalendarWeek,
  IconShoppingCart,
  IconBook2,
  IconSettings,
  type Icon,
} from '@tabler/icons-react'
import { NavLink, useLocation } from 'react-router'

interface NavItem {
  to: string
  label: string
  icon: Icon
  /** True when this tab should look active for the current path. */
  isActive: (pathname: string) => boolean
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/plan',
    label: 'Plan',
    icon: IconCalendarWeek,
    isActive: (path) => path === '/plan' || path.startsWith('/plan/'),
  },
  {
    to: '/lists',
    label: 'Groceries',
    icon: IconShoppingCart,
    isActive: (path) => path === '/lists' || path.startsWith('/lists/'),
  },
  {
    to: '/recipes',
    label: 'Recipes',
    icon: IconBook2,
    isActive: (path) => path === '/recipes' || path.startsWith('/recipes/'),
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: IconSettings,
    isActive: (path) => path === '/settings' || path.startsWith('/settings/'),
  },
]

export function BottomNav() {
  const { pathname } = useLocation()

  return (
    <Group h="100%" grow gap={0} px="xs">
      {NAV_ITEMS.map(({ to, label, icon: Icon, isActive }) => {
        const active = isActive(pathname)
        return (
          <NavLink key={to} to={to} style={{ textDecoration: 'none', width: '100%' }}>
            <UnstyledButton
              w="100%"
              py={8}
              c={active ? 'green' : 'dimmed'}
              style={{ minHeight: 44 }}
            >
              <Stack align="center" gap={4}>
                <Icon size={20} />
                <Text fz={10} fw={600}>
                  {label}
                </Text>
              </Stack>
            </UnstyledButton>
          </NavLink>
        )
      })}
    </Group>
  )
}
