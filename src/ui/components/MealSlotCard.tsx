import { ActionIcon, Badge, Group, Paper, Stack, Text, Menu, UnstyledButton } from '@mantine/core'
import { IconDots, IconX } from '@tabler/icons-react'
import { formatQuantity } from '../../domain/shared/formatQuantity'
import { MEAL_TYPE_LABELS } from '../../domain/shared/MealEnums'
import { componentLabel, type SlotComponentDisplay, type SlotDisplay } from '../plans/slotDisplay'

interface MealSlotCardProps {
  display: SlotDisplay
  onOpen: () => void
  onClear: () => void
  onExclude: () => void
  onUnexclude: () => void
}

function ComponentLine({ item, mealDate }: { item: SlotComponentDisplay; mealDate: string }) {
  const label = componentLabel(item)
  const qty = formatQuantity(item.component.allocatedQuantity)
  const isLeftover = item.cookingEvent !== undefined && item.cookingEvent.scheduledDate !== mealDate

  return (
    <Group gap={6} wrap="nowrap" align="flex-start">
      <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
        <Text size="sm" lineClamp={2}>
          {label}
        </Text>
        <Text size="xs" c="dimmed">
          {qty}
        </Text>
      </Stack>
      {isLeftover && (
        <Badge color="teal" variant="light" size="xs">
          Leftover
        </Badge>
      )}
    </Group>
  )
}

export function MealSlotCard({
  display,
  onOpen,
  onClear,
  onExclude,
  onUnexclude,
}: MealSlotCardProps) {
  const { slot, components } = display
  const hasComponents = components.length > 0

  if (slot.excluded) {
    return (
      <Paper withBorder p="sm" bg="gray.0">
        <Group justify="space-between" wrap="nowrap">
          <Stack gap={2}>
            <Text size="sm" fw={600}>
              {MEAL_TYPE_LABELS[slot.mealType]}
            </Text>
            <Badge color="gray" variant="light" size="sm" w="fit-content">
              Excluded
            </Badge>
          </Stack>
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" aria-label="Slot actions">
                <IconDots size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={onUnexclude}>Include again</Menu.Item>
              <Menu.Item onClick={onOpen}>Edit meal</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Paper>
    )
  }

  return (
    <Paper withBorder p="sm">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <UnstyledButton onClick={onOpen} style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <Stack gap={6}>
            <Text size="sm" fw={600}>
              {MEAL_TYPE_LABELS[slot.mealType]}
            </Text>
            {hasComponents ? (
              components.map((item) => (
                <ComponentLine key={item.component.id} item={item} mealDate={slot.date} />
              ))
            ) : (
              <Text size="sm" c="dimmed" fs="italic">
                Unplanned
              </Text>
            )}
          </Stack>
        </UnstyledButton>
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon variant="subtle" aria-label="Slot actions">
              <IconDots size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={onOpen}>{hasComponents ? 'Edit meal' : 'Add dish'}</Menu.Item>
            {hasComponents && (
              <Menu.Item color="red" leftSection={<IconX size={14} />} onClick={onClear}>
                Clear
              </Menu.Item>
            )}
            <Menu.Item onClick={onExclude}>Exclude / eating out</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Paper>
  )
}
