import { UnstyledButton, Stack, Text, Group } from '@mantine/core'
import {
  IconCalendarWeek,
  IconShoppingCart,
  IconBook2,
  IconSettings,
  type Icon,
} from '@tabler/icons-react'
import { NavLink, useLocation } from 'react-router'
import { useLocalization } from '../localization/LocalizationContext'
import type { MessageId } from '../localization/messages'

interface NavItem {
  to: string
  message: MessageId
  icon: Icon
  isActive: (pathname: string) => boolean
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/plan',
    message: 'nav.plan',
    icon: IconCalendarWeek,
    isActive: (path) => path === '/plan' || path.startsWith('/plan/'),
  },
  {
    to: '/lists',
    message: 'nav.groceries',
    icon: IconShoppingCart,
    isActive: (path) => path === '/lists' || path.startsWith('/lists/'),
  },
  {
    to: '/recipes',
    message: 'nav.recipes',
    icon: IconBook2,
    isActive: (path) => path === '/recipes' || path.startsWith('/recipes/'),
  },
  {
    to: '/settings',
    message: 'nav.settings',
    icon: IconSettings,
    isActive: (path) => path === '/settings' || path.startsWith('/settings/'),
  },
]

export function BottomNav() {
  const { pathname } = useLocation()
  const { t } = useLocalization()

  return (
    <Group h="100%" grow gap={0} px="xs">
      {NAV_ITEMS.map(({ to, message, icon: Icon, isActive }) => {
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
                  {t(message)}
                </Text>
              </Stack>
            </UnstyledButton>
          </NavLink>
        )
      })}
    </Group>
  )
}
