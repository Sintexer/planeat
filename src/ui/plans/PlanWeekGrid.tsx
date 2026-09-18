import { Box, Paper, Text, UnstyledButton } from '@mantine/core'
import { Note, Plus, Warning } from '@phosphor-icons/react'
import type { CSSProperties } from 'react'
import { hasUnallocatedRemainder, isCarryoverRisk } from '../../domain/plans/CookingEventAllocation'
import type { MealSlot } from '../../domain/plans/MealSlot'
import type { LocalDate } from '../../domain/shared/LocalDate'
import { MEAL_TYPES, type MealType } from '../../domain/shared/MealEnums'
import type { Quantity } from '../../domain/shared/Quantity'
import { mealTypeLabel } from '../localization/labels'
import { useLocalization } from '../localization/LocalizationContext'
import { RecipePhotoThumb } from '../components/RecipePhotoThumb'
import { MEAL_TYPE_ICONS } from './mealTypeIcons'
import { componentLabel, type SlotDisplay } from './slotDisplay'

interface PlanWeekGridProps {
  weekDates: LocalDate[]
  today: LocalDate
  displaysByDate: Map<LocalDate, SlotDisplay[]>
  remainingByEventId: ReadonlyMap<string, Quantity | null>
  onSelectDay: (date: LocalDate) => void
  onAddDish: (slot: MealSlot) => void
}

function shortWeekday(date: LocalDate, locale: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(locale, { weekday: 'short' }).toUpperCase()
}

function dayNumber(date: LocalDate): number {
  return Number(date.slice(8, 10))
}

function displayForMeal(
  displays: SlotDisplay[] | undefined,
  mealType: MealType,
): SlotDisplay | undefined {
  return displays?.find((d) => d.slot.mealType === mealType)
}

function cellMarkers(
  display: SlotDisplay | undefined,
  remainingByEventId: ReadonlyMap<string, Quantity | null>,
): { warning: boolean; note: boolean } {
  if (!display) return { warning: false, note: false }
  let warning = false
  let note = false
  for (const item of display.components) {
    const event = item.cookingEvent
    if (!event) continue
    const leftover = event.scheduledDate !== display.slot.date
    const risk = isCarryoverRisk(event.recipeSnapshot.reusePolicy)
    const unallocated = hasUnallocatedRemainder(remainingByEventId.get(event.id) ?? null)
    if ((leftover && risk) || (!leftover && unallocated && risk)) warning = true
    else if ((leftover && !risk) || (!leftover && unallocated && !risk)) note = true
  }
  return { warning, note: note && !warning }
}

const stickyBg: CSSProperties = {
  background: 'var(--mantine-color-body)',
}

const cellBorder: CSSProperties = {
  borderRight: '1px solid var(--mantine-color-default-border)',
  borderBottom: '1px solid var(--mantine-color-default-border)',
  boxSizing: 'border-box',
}

export function PlanWeekGrid({
  weekDates,
  today,
  displaysByDate,
  remainingByEventId,
  onSelectDay,
  onAddDish,
}: PlanWeekGridProps) {
  const { t, bcp47 } = useLocalization()

  return (
    <Box style={{ overflowX: 'auto', marginInline: -4 }}>
      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: `92px repeat(${weekDates.length}, 128px)`,
          width: 'max-content',
          minWidth: '100%',
        }}
      >
        <Box
          style={{
            ...stickyBg,
            ...cellBorder,
            position: 'sticky',
            top: 0,
            left: 0,
            zIndex: 3,
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" lts={0.6}>
            {t('plan.gridMeals')}
          </Text>
        </Box>

        {weekDates.map((date) => {
          const isToday = date === today
          return (
            <UnstyledButton
              key={date}
              onClick={() => onSelectDay(date)}
              aria-label={`${shortWeekday(date, bcp47)} ${dayNumber(date)}`}
              style={{
                ...stickyBg,
                ...cellBorder,
                position: 'sticky',
                top: 0,
                zIndex: 2,
                height: 56,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                background: isToday
                  ? 'color-mix(in srgb, var(--mantine-color-primary-6) 8%, var(--mantine-color-body))'
                  : 'var(--mantine-color-body)',
              }}
            >
              <Text size="xs" fw={600} c="dimmed" lts={0.4}>
                {shortWeekday(date, bcp47)}
              </Text>
              {isToday ? (
                <Box
                  w={26}
                  h={26}
                  style={{
                    borderRadius: '50%',
                    background: 'var(--mantine-color-primary-filled)',
                    color: 'var(--mantine-color-white)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'Sora, Inter, sans-serif',
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {dayNumber(date)}
                </Box>
              ) : (
                <Text fw={600} size="md" style={{ fontFamily: 'Sora, Inter, sans-serif' }}>
                  {dayNumber(date)}
                </Text>
              )}
            </UnstyledButton>
          )
        })}

        {MEAL_TYPES.map((mealType) => {
          const MealIcon = MEAL_TYPE_ICONS[mealType]
          return (
            <Box key={mealType} style={{ display: 'contents' }}>
              <Box
                style={{
                  ...stickyBg,
                  ...cellBorder,
                  position: 'sticky',
                  left: 0,
                  zIndex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '12px 6px',
                }}
              >
                <Box
                  w={28}
                  h={28}
                  style={{
                    borderRadius: '50%',
                    background:
                      'color-mix(in srgb, var(--mantine-color-primary-6) 12%, transparent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--mantine-color-primary-filled)',
                  }}
                >
                  <MealIcon size={14} />
                </Box>
                <Text size="xs" fw={600} c="dimmed" ta="center">
                  {mealTypeLabel(t, mealType)}
                </Text>
              </Box>

              {weekDates.map((date) => {
                const display = displayForMeal(displaysByDate.get(date), mealType)
                const isToday = date === today
                const { warning, note } = cellMarkers(display, remainingByEventId)
                const components = display?.components ?? []
                const empty = components.length === 0 && !display?.slot.excluded
                return (
                  <Box
                    key={`${date}-${mealType}`}
                    style={{
                      ...cellBorder,
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      padding: 8,
                      minHeight: 72,
                      background: isToday
                        ? 'color-mix(in srgb, var(--mantine-color-primary-6) 6%, var(--mantine-color-body))'
                        : 'var(--mantine-color-body)',
                    }}
                  >
                    {warning && (
                      <Box
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          background: 'var(--mantine-color-warning-6)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 1,
                        }}
                        aria-label={t('plan.wontCarryOver')}
                      >
                        <Warning size={9} weight="fill" color="white" />
                      </Box>
                    )}
                    {note && (
                      <Box
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          background: 'var(--mantine-color-dimmed)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 1,
                        }}
                        aria-label={t('catalog.leftovers')}
                      >
                        <Note size={9} weight="fill" color="white" />
                      </Box>
                    )}

                    {display?.slot.excluded && (
                      <UnstyledButton
                        onClick={() => onSelectDay(date)}
                        style={{ textAlign: 'left' }}
                      >
                        <Text size="xs" c="dimmed" fs="italic">
                          {t('slot.eatingOut')}
                        </Text>
                      </UnstyledButton>
                    )}

                    {components.map((item) => (
                      <UnstyledButton
                        key={item.component.id}
                        onClick={() => onSelectDay(date)}
                        style={{ textAlign: 'left' }}
                      >
                        <Paper withBorder p={6} radius="md">
                          <Box style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <RecipePhotoThumb
                              url={item.photoUrl}
                              label={componentLabel(item)}
                              size={32}
                            />
                            <Text size="sm" fw={500} lineClamp={2} style={{ flex: 1 }}>
                              {componentLabel(item)}
                            </Text>
                          </Box>
                        </Paper>
                      </UnstyledButton>
                    ))}

                    {empty && display && (
                      <UnstyledButton
                        onClick={() => onAddDish(display.slot)}
                        aria-label={t('slot.addDish')}
                        style={{
                          border: '1.5px dashed var(--mantine-color-default-border)',
                          borderRadius: 8,
                          minHeight: 40,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          color: 'var(--mantine-color-dimmed)',
                        }}
                      >
                        <Plus size={12} />
                        <Text size="sm" fw={500}>
                          {t('action.add')}
                        </Text>
                      </UnstyledButton>
                    )}

                    {empty && !display && (
                      <UnstyledButton
                        onClick={() => onSelectDay(date)}
                        style={{ minHeight: 40 }}
                        aria-label={t('slot.noSlot')}
                      />
                    )}
                  </Box>
                )
              })}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
