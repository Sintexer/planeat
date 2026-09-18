import { ActionIcon, Group, Stack, Title } from '@mantine/core'
import { CaretLeft } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useLocalization } from '../localization/LocalizationContext'

interface ScreenHeaderProps {
  title: ReactNode
  /** Used when there is no in-app history to go back to (deep link / refresh). */
  fallbackTo: string
  actions?: ReactNode
}

export function ScreenHeader({ title, fallbackTo, actions }: ScreenHeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useLocalization()

  const handleBack = () => {
    if (location.key !== 'default') {
      navigate(-1)
      return
    }
    navigate(fallbackTo)
  }

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1 }} align="flex-start">
          <ActionIcon
            variant="default"
            radius="xl"
            size={34}
            aria-label={t('action.back')}
            onClick={handleBack}
            style={{ flexShrink: 0 }}
          >
            <CaretLeft size={18} />
          </ActionIcon>
          <Title
            order={1}
            style={{ fontSize: 30, lineHeight: 1.2, margin: 0, minWidth: 0 }}
            lineClamp={3}
          >
            {title}
          </Title>
        </Group>
        {actions ? (
          <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
            {actions}
          </Group>
        ) : null}
      </Group>
    </Stack>
  )
}

interface PageTitleProps {
  children: ReactNode
  actions?: ReactNode
}

/** Large in-content title for tab root screens (no back). */
export function PageTitle({ children, actions }: PageTitleProps) {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm" mb={4}>
      <Title order={1} style={{ fontSize: 30, lineHeight: 1.2, margin: '4px 0 0' }}>
        {children}
      </Title>
      {actions ? (
        <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
          {actions}
        </Group>
      ) : null}
    </Group>
  )
}
