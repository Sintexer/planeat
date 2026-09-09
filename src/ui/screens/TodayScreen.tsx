import { Loader, Stack, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useEffect, useMemo, useState } from 'react'
import { useServices } from '../../app/servicesContext'
import type { MealSlot } from '../../domain/plans/MealSlot'
import {
  cookingEventsOnDate,
  effortUnitsForDate,
  formatPrepLabel,
} from '../../domain/plans/prepDaySummary'
import { formatEffortUnits } from '../../domain/plans/prepEffort'
import { evaluatePlanSoftPrompts, previousWeekStart } from '../../domain/plans/softPrompts'
import type { SimpleFood } from '../../domain/simpleFoods/SimpleFood'
import { startOfWeek, todayLocalDate } from '../../domain/shared/LocalDate'
import { MealEditor } from '../components/MealEditor'
import { MealSlotCard } from '../components/MealSlotCard'
import { SoftPromptAlerts } from '../components/SoftPromptAlerts'
import { usePlanByStartDate } from '../hooks/usePlanByStartDate'
import { useSettings } from '../hooks/useSettings'
import { useSimpleFoods } from '../hooks/useSimpleFoods'
import { confirmClearSlot, confirmExcludeSlot } from '../plans/slotConfirmations'
import { buildSlotDisplays, formatPlanDayHeading } from '../plans/slotDisplay'

export function TodayScreen() {
  const today = todayLocalDate()
  const settings = useSettings()
  const { planService } = useServices()
  const simpleFoods = useSimpleFoods()
  const [editorSlot, setEditorSlot] = useState<MealSlot | undefined>(undefined)

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

  const prevWeekGraph = usePlanByStartDate(
    graph ? previousWeekStart(graph.plan.startDate) : undefined,
  )

  const softPrompts = useMemo(() => {
    if (!graph || !settings) return []
    const previousIds = new Set<string>()
    if (prevWeekGraph) {
      for (const event of prevWeekGraph.cookingEvents) {
        previousIds.add(event.recipeId)
      }
    }
    const all = evaluatePlanSoftPrompts(graph, settings, previousIds)
    return all.filter((p) => !p.date || p.date === today)
  }, [graph, settings, prevWeekGraph, today])

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

  const editorDisplay = editorSlot ? displays.find((d) => d.slot.id === editorSlot.id) : undefined

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

      <SoftPromptAlerts prompts={softPrompts} />

      {(() => {
        const todayEvents = cookingEventsOnDate(graph, today)
        const units = effortUnitsForDate(graph, today)
        const prepLabel = formatPrepLabel(units)
        if (!prepLabel) return null
        return (
          <Stack gap="xs">
            <Text fw={600}>Preparation today</Text>
            <Text size="sm" c="dimmed">
              {prepLabel} ({formatEffortUnits(units)} unit{units === 1 ? '' : 's'})
            </Text>
            {todayEvents.map((event) => (
              <Text key={event.id} size="sm">
                {event.recipeSnapshot.name}
              </Text>
            ))}
          </Stack>
        )
      })()}

      <Stack gap="xs">
        {displays.map((display) => (
          <MealSlotCard
            key={display.slot.id}
            display={display}
            onOpen={() => setEditorSlot(display.slot)}
            onClear={() => void confirmClearSlot(planService, display.slot.id)}
            onExclude={() => void confirmExcludeSlot(planService, display.slot.id)}
            onUnexclude={() => void handleUnexclude(display.slot.id)}
          />
        ))}
      </Stack>

      {editorSlot && (
        <MealEditor
          opened={!!editorSlot}
          onClose={() => setEditorSlot(undefined)}
          slot={editorSlot}
          graph={graph}
          components={editorDisplay?.components ?? []}
        />
      )}
    </Stack>
  )
}
