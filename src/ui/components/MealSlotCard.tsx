import { ActionIcon, Badge, Group, Paper, Stack, Text, Menu } from '@mantine/core'
import { IconDots, IconX } from '@tabler/icons-react'
import { modals } from '@mantine/modals'
import type { CookingEvent } from '../../domain/plans/CookingEvent'
import type { MealComponent } from '../../domain/plans/MealComponent'
import type { MealSlot } from '../../domain/plans/MealSlot'
import { formatQuantity } from '../../domain/shared/formatQuantity'
import { MEAL_TYPE_LABELS } from '../../domain/shared/MealEnums'
import type { SimpleFood } from '../../domain/simpleFoods/SimpleFood'

export interface SlotDisplay {
  slot: MealSlot
  component: MealComponent | undefined
  cookingEvent: CookingEvent | undefined
  simpleFood: SimpleFood | undefined
}

interface MealSlotCardProps {
  display: SlotDisplay
  onPlace: () => void
  onClear: () => void
  onExclude: () => void
  onUnexclude: () => void
}

function dishLabel(display: SlotDisplay): string | undefined {
  if (display.cookingEvent) {
    return display.cookingEvent.recipeSnapshot.name
  }
  if (display.simpleFood) {
    return display.simpleFood.name
  }
  return undefined
}

export function MealSlotCard({
  display,
  onPlace,
  onClear,
  onExclude,
  onUnexclude,
}: MealSlotCardProps) {
  const { slot, component } = display
  const label = dishLabel(display)
  const qty = component ? formatQuantity(component.allocatedQuantity) : undefined

  const confirmClear = () => {
    modals.openConfirmModal({
      title: 'Clear meal',
      children: <Text size="sm">Remove the dish from this slot?</Text>,
      labels: { confirm: 'Clear', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: onClear,
    })
  }

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
              <Menu.Item onClick={onPlace}>Place a dish</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Paper>
    )
  }

  return (
    <Paper withBorder p="sm">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
          <Text size="sm" fw={600}>
            {MEAL_TYPE_LABELS[slot.mealType]}
          </Text>
          {label ? (
            <>
              <Text size="sm" lineClamp={2}>
                {label}
              </Text>
              {qty && (
                <Text size="xs" c="dimmed">
                  {qty}
                </Text>
              )}
            </>
          ) : (
            <Text size="sm" c="dimmed" fs="italic">
              Unplanned
            </Text>
          )}
        </Stack>
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon variant="subtle" aria-label="Slot actions">
              <IconDots size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={onPlace}>{label ? 'Replace dish' : 'Place a dish'}</Menu.Item>
            {label && (
              <Menu.Item color="red" leftSection={<IconX size={14} />} onClick={confirmClear}>
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
