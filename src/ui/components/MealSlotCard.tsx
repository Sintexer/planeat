import {
  ActionIcon,
  Badge,
  Group,
  Paper,
  Stack,
  Text,
  Menu,
  UnstyledButton,
  useComputedColorScheme,
} from '@mantine/core'
import {
  IconCoffee,
  IconDots,
  IconMoonStars,
  IconPlus,
  IconToolsKitchen2,
  IconX,
} from '@tabler/icons-react'
import { MEAL_TYPE_LABELS, type MealType } from '../../domain/shared/MealEnums'
import { RecipePhotoThumb } from './RecipePhotoThumb'
import { useFormatQuantity } from '../localization/useFormatQuantity'
import { useLocalization } from '../localization/LocalizationContext'
import { componentLabel, type SlotComponentDisplay, type SlotDisplay } from '../plans/slotDisplay'

interface MealSlotCardProps {
  display: SlotDisplay
  onOpen: () => void
  onClear: () => void
  onExclude: () => void
  onUnexclude: () => void
}

const MEAL_ICONS: Record<MealType, typeof IconCoffee> = {
  breakfast: IconCoffee,
  lunch: IconToolsKitchen2,
  dinner: IconMoonStars,
}

const MEAL_ACCENT: Record<MealType, string> = {
  breakfast: 'yellow',
  lunch: 'green',
  dinner: 'indigo',
}

function DishRow({
  item,
  mealDate,
  onOpen,
}: {
  item: SlotComponentDisplay
  mealDate: string
  onOpen: () => void
}) {
  const formatQty = useFormatQuantity()
  const label = componentLabel(item)
  const qty = formatQty(item.component.allocatedQuantity)
  const isLeftover = item.cookingEvent !== undefined && item.cookingEvent.scheduledDate !== mealDate

  return (
    <UnstyledButton onClick={onOpen} w="100%" style={{ textAlign: 'left' }}>
      <Paper p={8} radius="md" shadow="xs">
        <Group wrap="nowrap" align="center" gap="sm">
          <RecipePhotoThumb url={item.photoUrl} label={label} size={56} />
          <Stack gap={6} style={{ minWidth: 0, flex: 1 }}>
            <Text size="sm" fw={600} lineClamp={2}>
              {label}
            </Text>
            <Group gap={6}>
              <Badge variant="light" size="sm" radius="xl" color="gray">
                {qty}
              </Badge>
              {isLeftover && (
                <Badge color="teal" variant="light" size="sm" radius="xl">
                  Leftover
                </Badge>
              )}
            </Group>
          </Stack>
        </Group>
      </Paper>
    </UnstyledButton>
  )
}

function AddDishButton({
  onOpen,
  colorScheme,
  label,
}: {
  onOpen: () => void
  colorScheme: 'light' | 'dark'
  label: string
}) {
  return (
    <UnstyledButton onClick={onOpen} w="100%" style={{ textAlign: 'center' }}>
      <Paper p={10} radius="md" bg={colorScheme === 'dark' ? 'dark.5' : 'white'}>
        <Group gap={6} justify="center">
          <IconPlus size={16} />
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
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" aria-label="Slot actions">
          <IconDots size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {excluded ? (
          <>
            <Menu.Item onClick={onUnexclude}>Include again</Menu.Item>
            <Menu.Item onClick={onOpen}>Edit meal</Menu.Item>
          </>
        ) : (
          <>
            <Menu.Item onClick={onOpen}>{hasComponents ? 'Edit meal' : 'Add dish'}</Menu.Item>
            {hasComponents && (
              <Menu.Item color="red" leftSection={<IconX size={14} />} onClick={onClear}>
                Clear
              </Menu.Item>
            )}
            <Menu.Item onClick={onExclude}>Exclude / eating out</Menu.Item>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
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
  const MealIcon = MEAL_ICONS[slot.mealType]
  const accent = MEAL_ACCENT[slot.mealType]
  const colorScheme = useComputedColorScheme('light')
  const cardBg = colorScheme === 'dark' ? `${accent}.9` : `${accent}.0`
  const { t } = useLocalization()

  return (
    <Paper p="sm" radius="lg" bg={cardBg}>
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap" align="center">
          <Group gap="sm" wrap="nowrap">
            <Paper
              radius="xl"
              w={32}
              h={32}
              bg={`${accent}.5`}
              c="white"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <MealIcon size={16} />
            </Paper>
            <Text fw={700}>{MEAL_TYPE_LABELS[slot.mealType]}</Text>
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
              <DishRow key={item.component.id} item={item} mealDate={slot.date} onOpen={onOpen} />
            ))}
            {!hasComponents && (
              <Paper
                p={12}
                radius="md"
                bg={colorScheme === 'dark' ? 'dark.6' : 'gray.1'}
                withBorder={false}
              >
                <Text size="sm" c="dimmed">
                  {t('slot.notPlanned')}
                </Text>
              </Paper>
            )}
            <AddDishButton onOpen={onOpen} colorScheme={colorScheme} label={t('slot.addDish')} />
          </>
        )}
      </Stack>
    </Paper>
  )
}
