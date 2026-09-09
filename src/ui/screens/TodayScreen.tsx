import { Loader, Stack, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useEffect, useMemo, useState } from 'react'
import { useServices } from '../../app/servicesContext'
import type { MealSlot } from '../../domain/plans/MealSlot'
import type { SimpleFood } from '../../domain/simpleFoods/SimpleFood'
import { startOfWeek, todayLocalDate } from '../../domain/shared/LocalDate'
import { MealItemPicker, type MealPick } from '../components/MealItemPicker'
import { MealSlotCard } from '../components/MealSlotCard'
import { usePlanByStartDate } from '../hooks/usePlanByStartDate'
import { useSettings } from '../hooks/useSettings'
import { useSimpleFoods } from '../hooks/useSimpleFoods'
import { buildSlotDisplays, formatPlanDayHeading } from '../plans/slotDisplay'

export function TodayScreen() {
  const today = todayLocalDate()
  const settings = useSettings()
  const { planService } = useServices()
  const simpleFoods = useSimpleFoods()
  const [pickerSlot, setPickerSlot] = useState<MealSlot | undefined>(undefined)

  const weekStart = settings ? startOfWeek(today, settings.weekStartDay) : undefined
  const graphOrNull = usePlanByStartDate(weekStart)

  useEffect(() => {
    if (!weekStart || graphOrNull !== null) return
    void planService.getOrCreatePlanForWeek(weekStart).then((result) => {
      if (!result.ok) {
        notifications.show({ message: 'Could not create week plan', color: 'red' })
      }
    })
  }, [weekStart, graphOrNull, planService])

  const graph = graphOrNull ?? undefined
  const loading = settings === undefined || graphOrNull === undefined || graphOrNull === null

  const simpleFoodsById = useMemo(() => {
    const map = new Map<string, SimpleFood>()
    for (const food of simpleFoods ?? []) {
      map.set(food.id, food)
    }
    return map
  }, [simpleFoods])

  const displays = useMemo(
    () => (graph ? buildSlotDisplays(graph, simpleFoodsById, today) : []),
    [graph, simpleFoodsById, today],
  )

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
        <Text c="dimmed">Loading today…</Text>
      </Stack>
    )
  }

  if (!graph) {
    return (
      <Stack gap="md">
        <Title order={2}>Today</Title>
        <Text c="dimmed">Could not load today’s plan.</Text>
      </Stack>
    )
  }

  return (
    <Stack gap="md">
      <Title order={2}>Today</Title>
      <Text c="dimmed" size="sm">
        {formatPlanDayHeading(today)}
      </Text>

      <Stack gap="xs">
        {displays.map((display) => (
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
