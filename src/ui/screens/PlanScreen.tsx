import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Stack,
  Text,
  UnstyledButton,
  Loader,
  Paper,
} from '@mantine/core'
import {
  IconCalendar,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
} from '@tabler/icons-react'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useServices } from '../../app/servicesContext'
import type { Recipe } from '../../domain/recipes/Recipe'
import type { MealSlot } from '../../domain/plans/MealSlot'
import { hasUnallocatedRemainder } from '../../domain/plans/CookingEventAllocation'
import {
  cookingEventsOnDate,
  effortUnitsForDate,
  formatPrepLabel,
} from '../../domain/plans/prepDaySummary'
import { evaluatePlanSoftPrompts, previousWeekStart } from '../../domain/plans/softPrompts'
import { isDayPlanned } from '../../domain/plans/weekOverview'
import type { SimpleFood } from '../../domain/simpleFoods/SimpleFood'
import { useFormatQuantity } from '../localization/useFormatQuantity'
import { useLocalization } from '../localization/LocalizationContext'
import {
  addDays,
  enumeratePlanDates,
  planWeekLabel,
  startOfWeek,
  todayLocalDate,
  type LocalDate,
} from '../../domain/shared/LocalDate'
import { MEAL_TYPES } from '../../domain/shared/MealEnums'
import { MealEditor } from '../components/MealEditor'
import { MealSlotCard } from '../components/MealSlotCard'
import { PlanWeekPicker } from '../components/PlanWeekPicker'
import { PageTitle } from '../components/ScreenHeader'
import { SoftPromptAlerts } from '../components/SoftPromptAlerts'
import { usePlan } from '../hooks/usePlan'
import { usePlanByStartDate } from '../hooks/usePlanByStartDate'
import { useRecipes } from '../hooks/useRecipes'
import { useSettings } from '../hooks/useSettings'
import { useSimpleFoods } from '../hooks/useSimpleFoods'
import { confirmClearSlot, confirmExcludeSlot } from '../plans/slotConfirmations'
import { buildSlotDisplays, type SlotDisplay } from '../plans/slotDisplay'

function shortWeekday(date: LocalDate, locale: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(locale, { weekday: 'short' })
}

function dayNumber(date: LocalDate): number {
  return Number(date.slice(8, 10))
}

function defaultSelectedDay(weekStart: LocalDate, today: LocalDate): LocalDate {
  const end = addDays(weekStart, 6)
  if (today >= weekStart && today <= end) return today
  return weekStart
}

function monthFromDate(date: LocalDate): { year: number; month: number } {
  const [year, month] = date.split('-').map(Number)
  return { year, month }
}

export function PlanScreen() {
  const { planId: routePlanId } = useParams()
  const navigate = useNavigate()
  const settings = useSettings()
  const { planService, groceryService } = useServices()
  const simpleFoods = useSimpleFoods()
  const recipes = useRecipes()
  const formatQty = useFormatQuantity()
  const { t, bcp47 } = useLocalization()

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

  const [dayOverride, setDayOverride] = useState<LocalDate | undefined>(undefined)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState<{ year: number; month: number }>(() =>
    monthFromDate(today),
  )

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
    return evaluatePlanSoftPrompts(graph, settings, previousIds)
  }, [graph, settings, prevWeekGraph])

  const simpleFoodsById = useMemo(() => {
    const map = new Map<string, SimpleFood>()
    for (const food of simpleFoods ?? []) {
      map.set(food.id, food)
    }
    return map
  }, [simpleFoods])

  const recipesById = useMemo(() => {
    const map = new Map<string, Recipe>()
    for (const recipe of recipes ?? []) {
      map.set(recipe.id, recipe)
    }
    return map
  }, [recipes])

  const weekDates = useMemo(
    () => (graph ? enumeratePlanDates(graph.plan.startDate, 7) : []),
    [graph],
  )

  const activeDay = useMemo(() => {
    if (!graph) return today
    if (dayOverride && weekDates.includes(dayOverride)) return dayOverride
    return defaultSelectedDay(graph.plan.startDate, today)
  }, [graph, dayOverride, weekDates, today])

  const dayDisplays = useMemo(
    () => (graph ? buildSlotDisplays(graph, simpleFoodsById, activeDay, recipesById) : []),
    [graph, simpleFoodsById, activeDay, recipesById],
  )

  const displaysByMeal = useMemo(() => {
    const map = new Map<string, SlotDisplay[]>()
    for (const meal of MEAL_TYPES) map.set(meal, [])
    for (const display of dayDisplays) {
      const list = map.get(display.slot.mealType) ?? []
      list.push(display)
      map.set(display.slot.mealType, list)
    }
    return map
  }, [dayDisplays])

  const [editorSlot, setEditorSlot] = useState<MealSlot | undefined>(undefined)
  const editorDisplay = editorSlot
    ? dayDisplays.find((d) => d.slot.id === editorSlot.id)
    : undefined

  const openWeek = async (weekStart: LocalDate) => {
    const result = await planService.getOrCreatePlanForWeek(weekStart)
    if (!result.ok) {
      notifications.show({ message: 'Could not open that week', color: 'red' })
      return
    }
    setCalendarOpen(false)
    setDayOverride(undefined)
    navigate(`/plan/${result.graph.plan.id}`)
  }

  const goToAdjacentWeek = async (direction: -1 | 1) => {
    if (!graph) return
    const nextStart = planService.adjacentWeekStart(graph.plan.startDate, direction)
    await openWeek(nextStart)
  }

  const toggleCalendar = () => {
    if (!graph) return
    setCalendarOpen((open) => {
      if (!open) setCalendarMonth(monthFromDate(graph.plan.startDate))
      return !open
    })
  }

  const handleUnexclude = async (slotId: string) => {
    const result = await planService.setSlotExcluded(slotId, false)
    if (!result.ok) {
      notifications.show({ message: 'Could not update slot', color: 'red' })
    }
  }

  const createGroceryList = async () => {
    if (!graph) return
    const result = await groceryService.generateFromPlan(graph.plan.id)
    if (!result.ok) {
      notifications.show({ message: `Could not generate list (${result.error})`, color: 'red' })
      return
    }
    notifications.show({ message: 'Grocery list created', color: 'green' })
    navigate(`/lists/${result.list.id}`)
  }

  const updateGroceryList = async (listId: string) => {
    const result = await groceryService.updateFromPlan(listId)
    if (!result.ok) {
      notifications.show({ message: `Could not update list (${result.error})`, color: 'red' })
      return
    }
    notifications.show({ message: 'Grocery list updated', color: 'green' })
    navigate(`/lists/${result.list.id}`)
  }

  const handleGenerateGroceries = async () => {
    if (!graph) return
    const existing = await groceryService.findOpenListForPlan(graph.plan.id)
    if (!existing) {
      await createGroceryList()
      return
    }

    const revisionDrift = existing.sourcePlanRevision !== graph.plan.revision
    const previewResult = await groceryService.previewUpdateFromPlan(existing.id)
    const preview = previewResult.ok ? previewResult.preview : undefined
    modals.open({
      title: t('grocery.updateTitle'),
      children: (
        <Stack gap="sm">
          <Text size="sm">
            An open list “{existing.title}” is linked to this plan
            {revisionDrift ? ', and the plan has changed since that list was generated.' : '.'}
          </Text>
          <Text size="sm">{t('grocery.updateBody')}</Text>
          {preview && (
            <>
              {preview.added.length > 0 && (
                <Text size="sm">Added: {preview.added.map((line) => line.label).join(', ')}</Text>
              )}
              {preview.removed.length > 0 && (
                <Text size="sm">Removed: {preview.removed.map((line) => line.label).join(', ')}</Text>
              )}
              {preview.changed.length > 0 && (
                <Text size="sm">Quantity changes: {preview.changed.length}</Text>
              )}
              <Text size="sm" c="dimmed">
                Manual items kept: {preview.manualKeptCount}. Checkmarks preserved:{' '}
                {preview.checksPreservedCount}.
              </Text>
            </>
          )}
          <Button
            onClick={() => {
              modals.closeAll()
              void updateGroceryList(existing.id)
            }}
          >
            {t('grocery.updateExisting')}
          </Button>
          <Button
            variant="light"
            onClick={() => {
              modals.closeAll()
              void createGroceryList()
            }}
          >
            {t('grocery.createNew')}
          </Button>
          <Button variant="default" onClick={() => modals.closeAll()}>
            Cancel
          </Button>
        </Stack>
      ),
    })
  }

  if (loading) {
    return (
      <Stack gap="md" align="center" py="xl">
        <Loader size="sm" />
        <Text c="dimmed">Loading plan…</Text>
      </Stack>
    )
  }

  if (!graph || !settings) {
    return (
      <Stack gap="md">
        <PageTitle>Plan</PageTitle>
        <Text c="dimmed">Could not load this week plan.</Text>
      </Stack>
    )
  }

  const endDate = addDays(graph.plan.startDate, 6)
  const thisWeekStart = startOfWeek(today, settings.weekStartDay)
  const isHistoryWeek = graph.plan.startDate < thisWeekStart
  const accent = isHistoryWeek ? 'gray' : 'green'
  const prepLabel = formatPrepLabel(effortUnitsForDate(graph, activeDay))
  const dayEvents = cookingEventsOnDate(graph, activeDay)
  const dayPrompts = softPrompts.filter((p) => p.date === activeDay)
  const weekPrompts = softPrompts.filter((p) => !p.date)
  const label = planWeekLabel(graph.plan.startDate, today, settings.weekStartDay)
  const remainingThisWeek = graph.cookingEvents
    .map((event) => ({
      id: event.id,
      name: event.recipeSnapshot.name,
      remaining: planService.remainingForCookingEvent(graph, event.id),
    }))
    .filter((row) => hasUnallocatedRemainder(row.remaining))

  return (
    <Stack gap="lg">
      <PageTitle
        actions={
          isHistoryWeek ? (
            <Badge color="gray" variant="light" radius="xl">
              Past week
            </Badge>
          ) : undefined
        }
      >
        Plan
      </PageTitle>

      <Group justify="space-between" align="center">
        <ActionIcon
          variant="default"
          radius="xl"
          size={32}
          aria-label="Previous week"
          onClick={() => void goToAdjacentWeek(-1)}
        >
          <IconChevronLeft size={18} />
        </ActionIcon>
        <UnstyledButton
          onClick={toggleCalendar}
          px={10}
          py={6}
          style={{ borderRadius: 999 }}
          aria-expanded={calendarOpen}
          aria-label="Toggle week calendar"
        >
          <Group gap={6} justify="center">
            <IconCalendar size={15} style={isHistoryWeek ? { opacity: 0.55 } : undefined} />
            <Stack gap={0} align="center">
              <Text fw={600} size="sm" c={isHistoryWeek ? 'dimmed' : undefined}>
                {label}
              </Text>
              <Text size="xs" c="dimmed">
                {graph.plan.startDate} – {endDate} · {graph.plan.peopleCount} people
              </Text>
            </Stack>
            {calendarOpen ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
          </Group>
        </UnstyledButton>
        <ActionIcon
          variant="default"
          radius="xl"
          size={32}
          aria-label="Next week"
          onClick={() => void goToAdjacentWeek(1)}
        >
          <IconChevronRight size={18} />
        </ActionIcon>
      </Group>

      {calendarOpen && (
        <PlanWeekPicker
          year={calendarMonth.year}
          month={calendarMonth.month}
          weekStartDay={settings.weekStartDay}
          selectedWeekStart={graph.plan.startDate}
          today={today}
          onMonthChange={(year, month) => setCalendarMonth({ year, month })}
          onSelectWeek={(weekStart) => void openWeek(weekStart)}
        />
      )}

      <Group gap={4} justify="space-between" wrap="nowrap">
        {weekDates.map((date) => {
          const active = date === activeDay
          const isToday = date === today
          const isPastDay = date < today
          const planned = isDayPlanned(graph, date)
          return (
            <UnstyledButton
              key={date}
              onClick={() => setDayOverride(date)}
              style={{ flex: 1, minWidth: 0 }}
              aria-label={`${shortWeekday(date, bcp47)} ${dayNumber(date)}, ${planned ? 'planned' : 'empty'}`}
            >
              <Stack gap={6} align="center">
                <Text
                  size="xs"
                  c={active || planned ? undefined : 'dimmed'}
                  fw={active || planned ? 600 : 400}
                  style={isHistoryWeek || isPastDay ? { opacity: 0.75 } : undefined}
                >
                  {shortWeekday(date, bcp47)}
                </Text>
                <Paper
                  radius="xl"
                  w={32}
                  h={32}
                  bg={
                    active
                      ? `${accent}.6`
                      : planned
                        ? `${accent}.1`
                        : isToday
                          ? `${accent}.0`
                          : 'transparent'
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: active
                      ? undefined
                      : planned
                        ? `1.5px solid var(--mantine-color-${accent}-4)`
                        : '1.5px dashed var(--mantine-color-default-border)',
                  }}
                >
                  <Text
                    size="sm"
                    fw={600}
                    c={
                      active
                        ? 'white'
                        : planned
                          ? undefined
                          : isHistoryWeek || isPastDay
                            ? 'dimmed'
                            : 'dimmed'
                    }
                  >
                    {dayNumber(date)}
                  </Text>
                </Paper>
              </Stack>
            </UnstyledButton>
          )
        })}
      </Group>

      {remainingThisWeek.length > 0 && (
        <Group gap={6} wrap="wrap">
          {remainingThisWeek.map((row) => (
            <Badge key={row.id} variant="light" color={accent} radius="xl" size="sm">
              {row.name} · {formatQty(row.remaining)} remaining
            </Badge>
          ))}
        </Group>
      )}

      <Stack
        gap="lg"
        style={
          isHistoryWeek
            ? { opacity: 0.78, filter: 'grayscale(0.4)', transition: 'opacity 120ms ease' }
            : undefined
        }
      >
        {prepLabel && (
          <Text size="sm" c="dimmed">
            {prepLabel}
            {dayEvents.length > 0
              ? ` · ${dayEvents.map((event) => event.recipeSnapshot.name).join(', ')}`
              : ''}
          </Text>
        )}

        <SoftPromptAlerts prompts={weekPrompts} />
        <SoftPromptAlerts prompts={dayPrompts} omitDatePrefix />

        {!isDayPlanned(graph, activeDay) && (
          <Text size="sm" c="dimmed">
            {t('slot.notPlanned')}
          </Text>
        )}

        <Stack gap={22}>
          {MEAL_TYPES.map((mealType) => {
            const meals = displaysByMeal.get(mealType) ?? []
            if (meals.length === 0) {
              return (
                <Text key={mealType} size="sm" c="dimmed">
                  No slot
                </Text>
              )
            }
            return meals.map((display) => (
              <MealSlotCard
                key={display.slot.id}
                display={display}
                onOpen={() => setEditorSlot(display.slot)}
                onClear={() => void confirmClearSlot(planService, display.slot.id)}
                onExclude={() => void confirmExcludeSlot(planService, display.slot.id)}
                onUnexclude={() => void handleUnexclude(display.slot.id)}
              />
            ))
          })}
        </Stack>

        <Button
          onClick={() => void handleGenerateGroceries()}
          variant={isHistoryWeek ? 'default' : 'light'}
          color={isHistoryWeek ? 'gray' : undefined}
        >
          Generate groceries
        </Button>
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
