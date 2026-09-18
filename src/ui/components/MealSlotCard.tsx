import { ActionIcon, Badge, Group, Paper, Stack, Text, Menu, UnstyledButton } from '@mantine/core'
import { DotsThree, Plus, Warning, X } from '@phosphor-icons/react'
import { mealTypeLabel } from '../localization/labels'
import { RecipePhotoThumb } from './RecipePhotoThumb'
import { useFormatQuantity } from '../localization/useFormatQuantity'
import { useLocalization } from '../localization/LocalizationContext'
import { MEAL_TYPE_ICONS } from '../plans/mealTypeIcons'
import { componentLabel, type SlotComponentDisplay, type SlotDisplay } from '../plans/slotDisplay'

interface MealSlotCardProps {
  display: SlotDisplay
  /** IDs of cooking events with same-day/fresh-only leftovers that will be wasted after today. */
  wontCarryOverEventIds?: Set<string>
  onOpen: () => void
  onClear: () => void
  onExclude: () => void
  onUnexclude: () => void
}

function DishRow({
  item,
  mealDate,
  wontCarryOver,
  onOpen,
}: {
  item: SlotComponentDisplay
  mealDate: string
  wontCarryOver: boolean
  onOpen: () => void
}) {
  const formatQty = useFormatQuantity()
  const { t } = useLocalization()
  const label = componentLabel(item)
  const qty = formatQty(item.component.allocatedQuantity)
  const isLeftover = item.cookingEvent !== undefined && item.cookingEvent.scheduledDate !== mealDate

  return (
    <UnstyledButton onClick={onOpen} w="100%" style={{ textAlign: 'left' }}>
      <Group wrap="nowrap" align="center" gap="sm">
        <RecipePhotoThumb url={item.photoUrl} label={label} size={52} />
        <Stack gap={6} style={{ minWidth: 0, flex: 1 }}>
          <Text size="sm" fw={500} lineClamp={2}>
            {label}
          </Text>
          <Group gap={6}>
            <Badge variant="light" size="sm" radius="xl" color="gray">
              {qty}
            </Badge>
            {isLeftover && (
              <Badge variant="outline" color="gray" size="sm" radius="xl">
                {t('plan.leftover')}
              </Badge>
            )}
            {wontCarryOver && (
              <Badge
                color="warning"
                variant="light"
                size="sm"
                radius="xl"
                leftSection={<Warning size={12} />}
              >
                {t('plan.wontCarryOver')}
              </Badge>
            )}
          </Group>
        </Stack>
      </Group>
    </UnstyledButton>
  )
}

function AddDishButton({ onOpen, label }: { onOpen: () => void; label: string }) {
  return (
    <UnstyledButton onClick={onOpen} w="100%" style={{ textAlign: 'center' }}>
      <Paper
        p={10}
        radius="md"
        style={{
          border: '1.5px dashed var(--mantine-color-default-border)',
          background: 'transparent',
        }}
      >
        <Group gap={6} justify="center">
          <Plus size={16} />
          <Text size="sm" fw={500}>
            {label}
          </Text>
        </Group>
      </Paper>
    </UnstyledButton>
  )
}

function SlotMenu({
  excluded,
  hasComponents,
  onOpen,
  onClear,
  onExclude,
  onUnexclude,
}: {
  excluded: boolean
  hasComponents: boolean
  onOpen: () => void
  onClear: () => void
  onExclude: () => void
  onUnexclude: () => void
}) {
  const { t } = useLocalization()
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" aria-label={t('slot.actions')}>
          <DotsThree size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {excluded ? (
          <>
            <Menu.Item onClick={onUnexclude}>{t('slot.includeAgain')}</Menu.Item>
            <Menu.Item onClick={onOpen}>{t('slot.editMeal')}</Menu.Item>
          </>
        ) : (
          <>
            <Menu.Item onClick={onOpen}>
              {hasComponents ? t('slot.editMeal') : t('slot.addDish')}
            </Menu.Item>
            {hasComponents && (
              <Menu.Item color="error" leftSection={<X size={14} />} onClick={onClear}>
                {t('action.clear')}
              </Menu.Item>
            )}
            <Menu.Item onClick={onExclude}>{t('slot.excludeEatingOut')}</Menu.Item>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  )
}

export function MealSlotCard({
  display,
  wontCarryOverEventIds,
  onOpen,
  onClear,
  onExclude,
  onUnexclude,
}: MealSlotCardProps) {
  const { slot, components } = display
  const hasComponents = components.length > 0
  const MealIcon = MEAL_TYPE_ICONS[slot.mealType]
  const { t } = useLocalization()

  return (
    <Paper p="sm" radius="lg" withBorder>
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap" align="center">
          <Group gap="sm" wrap="nowrap">
            <Paper
              radius="xl"
              w={32}
              h={32}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'color-mix(in srgb, var(--mantine-color-primary-6) 12%, transparent)',
                color: 'var(--mantine-color-primary-filled)',
              }}
            >
              <MealIcon size={16} />
            </Paper>
            <Text fw={600} style={{ fontFamily: 'Sora, Inter, sans-serif' }}>
              {mealTypeLabel(t, slot.mealType)}
            </Text>
          </Group>
          <SlotMenu
            excluded={slot.excluded}
            hasComponents={hasComponents}
            onOpen={onOpen}
            onClear={onClear}
            onExclude={onExclude}
            onUnexclude={onUnexclude}
          />
        </Group>

        {slot.excluded ? (
          <Text size="sm" c="dimmed" fs="italic">
            {t('slot.eatingOut')}
          </Text>
        ) : (
          <>
            {components.map((item) => (
              <DishRow
                key={item.component.id}
                item={item}
                mealDate={slot.date}
                wontCarryOver={
                  item.cookingEvent !== undefined &&
                  (wontCarryOverEventIds?.has(item.cookingEvent.id) ?? false)
                }
                onOpen={onOpen}
              />
            ))}
            {!hasComponents && (
              <Text size="sm" c="dimmed">
                {t('slot.notPlanned')}
              </Text>
            )}
            <AddDishButton onOpen={onOpen} label={t('slot.addDish')} />
          </>
        )}
      </Stack>
    </Paper>
  )
}
