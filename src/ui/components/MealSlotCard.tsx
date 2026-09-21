import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Menu,
  UnstyledButton,
} from '@mantine/core'
import {
  ArrowUUpLeft,
  DotsThree,
  LockSimple,
  MagicWand,
  Plus,
  Stack as StackIcon,
  Warning,
  X,
} from '@phosphor-icons/react'
import { mealTypeLabel } from '../localization/labels'
import { RecipePhotoThumb } from './RecipePhotoThumb'
import { useFormatQuantity } from '../localization/useFormatQuantity'
import { useLocalization } from '../localization/LocalizationContext'
import type { MealSlot } from '../../domain/plans/MealSlot'
import type { Quantity } from '../../domain/shared/Quantity'
import { MEAL_TYPE_ICONS } from '../plans/mealTypeIcons'
import {
  componentLabel,
  dishMarker,
  type SlotComponentDisplay,
  type SlotDisplay,
} from '../plans/slotDisplay'

interface MealSlotCardProps {
  display: SlotDisplay
  /** IDs of cooking events with same-day/fresh-only leftovers that will be wasted after today. */
  wontCarryOverEventIds?: Set<string>
  remainingByEventId: ReadonlyMap<string, Quantity | null>
  onOpen: () => void
  onClear: () => void
  onExclude: () => void
  onUnexclude: () => void
  onLock: () => void
  onUnlock: () => void
  onGenerate?: () => void
  onRegenerate?: () => void
}

function DishRow({
  item,
  slot,
  remainingByEventId,
  wontCarryOver,
  onOpen,
}: {
  item: SlotComponentDisplay
  slot: MealSlot
  remainingByEventId: ReadonlyMap<string, Quantity | null>
  wontCarryOver: boolean
  onOpen: () => void
}) {
  const formatQty = useFormatQuantity()
  const { t } = useLocalization()
  const label = componentLabel(item)
  const qty = formatQty(item.component.allocatedQuantity)
  const marker = dishMarker(item, slot, remainingByEventId)
  const isLeftover = marker === 'reuse'

  return (
    <UnstyledButton onClick={onOpen} w="100%" style={{ textAlign: 'left' }}>
      <Group
        wrap="nowrap"
        align="center"
        gap="sm"
        p={marker ? 6 : 0}
        style={{
          borderRadius: 8,
          border:
            marker === 'reuse' ? '1.5px dashed var(--mantine-color-default-border)' : undefined,
          background:
            marker === 'prep'
              ? 'color-mix(in srgb, var(--mantine-color-primary-6) 8%, var(--mantine-color-body))'
              : undefined,
        }}
      >
        <Box style={{ position: 'relative', flexShrink: 0 }}>
          <RecipePhotoThumb url={item.photoUrl} label={label} size={52} />
          {marker && (
            <Box
              style={{
                position: 'absolute',
                top: -4,
                left: -4,
                width: 18,
                height: 18,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background:
                  marker === 'reuse'
                    ? 'var(--mantine-color-dimmed)'
                    : 'var(--mantine-color-primary-filled)',
                color: 'white',
              }}
              aria-hidden
            >
              {marker === 'reuse' ? (
                <ArrowUUpLeft size={10} weight="bold" />
              ) : (
                <StackIcon size={10} weight="fill" />
              )}
            </Box>
          )}
        </Box>
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
  locked,
  hasComponents,
  onOpen,
  onClear,
  onExclude,
  onUnexclude,
  onLock,
  onUnlock,
}: {
  excluded: boolean
  locked: boolean
  hasComponents: boolean
  onOpen: () => void
  onClear: () => void
  onExclude: () => void
  onUnexclude: () => void
  onLock: () => void
  onUnlock: () => void
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
            {locked ? (
              <Menu.Item onClick={onUnlock}>{t('slot.unlock')}</Menu.Item>
            ) : (
              <Menu.Item onClick={onLock}>{t('slot.lock')}</Menu.Item>
            )}
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
            {locked ? (
              <Menu.Item onClick={onUnlock}>{t('slot.unlock')}</Menu.Item>
            ) : (
              <Menu.Item onClick={onLock}>{t('slot.lock')}</Menu.Item>
            )}
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  )
}

export function MealSlotCard({
  display,
  wontCarryOverEventIds,
  remainingByEventId,
  onOpen,
  onClear,
  onExclude,
  onUnexclude,
  onLock,
  onUnlock,
  onGenerate,
  onRegenerate,
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
            {slot.generationLocked && (
              <Badge
                variant="light"
                size="sm"
                radius="xl"
                leftSection={<LockSimple size={12} weight="fill" />}
              >
                {t('slot.locked')}
              </Badge>
            )}
          </Group>
          <SlotMenu
            excluded={slot.excluded}
            locked={slot.generationLocked === true}
            hasComponents={hasComponents}
            onOpen={onOpen}
            onClear={onClear}
            onExclude={onExclude}
            onUnexclude={onUnexclude}
            onLock={onLock}
            onUnlock={onUnlock}
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
                slot={slot}
                remainingByEventId={remainingByEventId}
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
            {!hasComponents && onGenerate && (
              <Button
                fullWidth
                variant="light"
                leftSection={<MagicWand size={16} />}
                onClick={onGenerate}
              >
                {t('generation.generate')}
              </Button>
            )}
            {hasComponents && onRegenerate && (
              <Button
                fullWidth
                variant="light"
                leftSection={<MagicWand size={16} />}
                onClick={onRegenerate}
              >
                {t('generation.regenerate')}
              </Button>
            )}
          </>
        )}
      </Stack>
    </Paper>
  )
}
