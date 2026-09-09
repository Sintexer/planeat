import { ActionIcon, Group, Stack, Text, Title, Loader } from '@mantine/core'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useServices } from '../../app/servicesContext'
import type { MealSlot } from '../../domain/plans/MealSlot'
import type { SimpleFood } from '../../domain/simpleFoods/SimpleFood'
import { addDays, startOfWeek, todayLocalDate, type LocalDate } from '../../domain/shared/LocalDate'
import { MealItemPicker, type MealPick } from '../components/MealItemPicker'
import { MealSlotCard } from '../components/MealSlotCard'
import { usePlan } from '../hooks/usePlan'
import { usePlanByStartDate } from '../hooks/usePlanByStartDate'
import { useSettings } from '../hooks/useSettings'
import { useSimpleFoods } from '../hooks/useSimpleFoods'
import { buildSlotDisplays, formatPlanDayHeading, groupDisplaysByDate } from '../plans/slotDisplay'

export function WeekScreen() {
  const { planId: routePlanId } = useParams()
  const navigate = useNavigate()
  const settings = useSettings()
  const { planService } = useServices()
  const simpleFoods = useSimpleFoods()

  const today = todayLocalDate()
  const weekStartFromSettings = settings ? startOfWeek(today, settings.weekStartDay) : undefined

  const fromRoute = usePlan(routePlanId)
  const fromStartDate = usePlanByStartDate(routePlanId ? undefined : weekStartFromSettings)

  useEffect(() => {
    if (routePlanId || !weekStartFromSettings || fromStartDate !== null) return
    void planService.getOrCreatePlanForWeek(weekStartFromSettings).then((result) => {
      if (!result.ok) {
        notifications.show({ message: 'Could not create week plan', color: 'red' })
      }
    })
  }, [routePlanId, weekStartFromSettings, fromStartDate, planService])

  const graph = routePlanId ? fromRoute : (fromStartDate ?? undefined)
  const loading = routePlanId
    ? fromRoute === undefined
    : settings === undefined || fromStartDate === undefined || fromStartDate === null

  const simpleFoodsById = useMemo(() => {
    const map = new Map<string, SimpleFood>()
    for (const food of simpleFoods ?? []) {
      map.set(food.id, food)
    }
    return map
  }, [simpleFoods])

  const displays = useMemo(
    () => (graph ? buildSlotDisplays(graph, simpleFoodsById) : []),
    [graph, simpleFoodsById],
  )
  const byDate = useMemo(() => groupDisplaysByDate(displays), [displays])

  const [pickerSlot, setPickerSlot] = useState<MealSlot | undefined>(undefined)

  const goToAdjacentWeek = async (direction: -1 | 1) => {
    if (!graph) return
    const nextStart = planService.adjacentWeekStart(graph.plan.startDate, direction)
    const result = await planService.getOrCreatePlanForWeek(nextStart)
    if (!result.ok) {
      notifications.show({ message: 'Could not open that week', color: 'red' })
      return
    }
    navigate(`/week/${result.graph.plan.id}`)
  }

  const handlePick = async (pick: MealPick) => {
    if (!pickerSlot) return
    const result =
      pick.kind === 'recipe'
        ? await planService.placeRecipe(pickerSlot.id, pick.recipeId)
        : await planService.placeSimpleFood(pickerSlot.id, pick.simpleFoodId)
    if (!result.ok) {
      notifications.show({ message: `Could not place dish (${result.error})`, color: 'red' })
    }
  }

  const handleClear = async (slotId: string) => {
    const result = await planService.clearSlot(slotId)
    if (!result.ok) {
      notifications.show({ message: 'Could not clear slot', color: 'red' })
    }
  }

  const handleExclude = async (slotId: string) => {
    const result = await planService.setSlotExcluded(slotId, true)
    if (!result.ok) {
      notifications.show({ message: 'Could not exclude slot', color: 'red' })
    }
  }

  const handleUnexclude = async (slotId: string) => {
    const result = await planService.setSlotExcluded(slotId, false)
    if (!result.ok) {
      notifications.show({ message: 'Could not update slot', color: 'red' })
    }
  }

  if (loading) {
    return (
      <Stack gap="md" align="center" py="xl">
        <Loader size="sm" />
        <Text c="dimmed">Loading week…</Text>
      </Stack>
    )
  }

  if (!graph) {
    return (
      <Stack gap="md">
        <Title order={2}>Week</Title>
        <Text c="dimmed">Could not load this week plan.</Text>
      </Stack>
    )
  }

  const endDate = addDays(graph.plan.startDate, 6)

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <ActionIcon
          variant="subtle"
          aria-label="Previous week"
          onClick={() => void goToAdjacentWeek(-1)}
        >
          <IconChevronLeft size={22} />
        </ActionIcon>
        <Stack gap={0} align="center">
          <Title order={2}>Week</Title>
          <Text size="sm" c="dimmed">
            {graph.plan.startDate} – {endDate}
          </Text>
          <Text size="xs" c="dimmed">
            {graph.plan.peopleCount} people
          </Text>
        </Stack>
        <ActionIcon
          variant="subtle"
          aria-label="Next week"
          onClick={() => void goToAdjacentWeek(1)}
        >
          <IconChevronRight size={22} />
        </ActionIcon>
      </Group>

      {[...byDate.entries()].map(([date, dayDisplays]) => (
        <Stack key={date} gap="xs">
          <Text fw={600}>{formatPlanDayHeading(date as LocalDate)}</Text>
          {dayDisplays.map((display) => (
            <MealSlotCard
              key={display.slot.id}
              display={display}
              onPlace={() => setPickerSlot(display.slot)}
              onClear={() => void handleClear(display.slot.id)}
              onExclude={() => void handleExclude(display.slot.id)}
              onUnexclude={() => void handleUnexclude(display.slot.id)}
            />
          ))}
        </Stack>
      ))}

      {pickerSlot && (
        <MealItemPicker
          opened={!!pickerSlot}
          onClose={() => setPickerSlot(undefined)}
          mealType={pickerSlot.mealType}
          onPick={(pick) => void handlePick(pick)}
        />
      )}
    </Stack>
  )
}
