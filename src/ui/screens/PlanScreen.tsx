import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
  Loader,
  Modal,
  Paper,
} from '@mantine/core'
import {
  Calendar,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  MagicWand,
  ShoppingBag,
  Warning,
} from '@phosphor-icons/react'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useServices } from '../../app/servicesContext'
import type { GroceryUpdateChoices } from '../../application/groceries/GroceryService'
import type { Recipe } from '../../domain/recipes/Recipe'
import type { MealSlot } from '../../domain/plans/MealSlot'
import { hasUnallocatedRemainder, isCarryoverRisk } from '../../domain/plans/CookingEventAllocation'
import { effortUnitsForDate, cookingEventsOnDate } from '../../domain/plans/prepDaySummary'
import { formatEffortUnits } from '../../domain/plans/prepEffort'
import { evaluatePlanSoftPrompts, previousWeekStart } from '../../domain/plans/softPrompts'
import { isDayPlanned } from '../../domain/plans/weekOverview'
import type { SimpleFood } from '../../domain/simpleFoods/SimpleFood'
import { useFormatQuantity } from '../localization/useFormatQuantity'
import { useLocalization } from '../localization/LocalizationContext'
import { formatPlanWeekLabel, planWeekRelation } from '../localization/formatDate'
import {
  addDays,
  enumeratePlanDates,
  startOfWeek,
  todayLocalDate,
  type LocalDate,
} from '../../domain/shared/LocalDate'
import { MEAL_TYPES } from '../../domain/shared/MealEnums'
import { GroceryUpdatePreview } from '../components/GroceryUpdatePreview'
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
import { openGenerateMealPreview } from '../plans/openGenerateMeal'
import { GenerateMealsModal } from '../plans/GenerateMealsModal'
import { PlanWeekGrid } from '../plans/PlanWeekGrid'
import { buildSlotDisplays, groupDisplaysByDate, type SlotDisplay } from '../plans/slotDisplay'
import type { Quantity } from '../../domain/shared/Quantity'

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
  const [searchParams] = useSearchParams()
  const dateQuery = searchParams.get('date')
  const settings = useSettings()
  const { planService, groceryService, generationService } = useServices()
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
        notifications.show({ message: t('plan.createFailed'), color: 'error' })
      }
    })
  }, [routePlanId, weekStartFromSettings, fromStartDate, planService, t])

  const graph = routePlanId ? fromRoute : (fromStartDate ?? undefined)
  const loading = routePlanId
    ? fromRoute === undefined
    : settings === undefined || fromStartDate === undefined || fromStartDate === null

  const [viewMode, setViewMode] = useState<'week' | 'day'>(() => (dateQuery ? 'day' : 'week'))
  const [dayOverride, setDayOverride] = useState<LocalDate | undefined>(undefined)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [generateMealsOpen, setGenerateMealsOpen] = useState(false)
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
    if (dateQuery && weekDates.includes(dateQuery)) return dateQuery
    return defaultSelectedDay(graph.plan.startDate, today)
  }, [graph, dayOverride, weekDates, today, dateQuery])

  const weekDisplays = useMemo(
    () => (graph ? buildSlotDisplays(graph, simpleFoodsById, undefined, recipesById) : []),
    [graph, simpleFoodsById, recipesById],
  )

  const displaysByDate = useMemo(() => groupDisplaysByDate(weekDisplays), [weekDisplays])

  const dayDisplays = useMemo(
    () => displaysByDate.get(activeDay) ?? [],
    [displaysByDate, activeDay],
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
    ? weekDisplays.find((d) => d.slot.id === editorSlot.id)
    : undefined

  const remainingByEventId = useMemo(() => {
    const map = new Map<string, Quantity | null>()
    if (!graph) return map
    for (const event of graph.cookingEvents) {
      map.set(event.id, planService.remainingForCookingEvent(graph, event.id))
    }
    return map
  }, [graph, planService])

  const openDay = (date: LocalDate) => {
    setDayOverride(date)
    setViewMode('day')
  }

  const openWeek = async (weekStart: LocalDate) => {
    const result = await planService.getOrCreatePlanForWeek(weekStart)
    if (!result.ok) {
      notifications.show({ message: t('plan.openFailed'), color: 'error' })
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
      notifications.show({ message: t('plan.unexcludeFailed'), color: 'error' })
    }
  }

  const createGroceryList = async () => {
    if (!graph) return
    const result = await groceryService.generateFromPlan(graph.plan.id)
    if (!result.ok) {
      notifications.show({
        message: t('grocery.generateFailed', { error: result.error }),
        color: 'error',
      })
      return
    }
    notifications.show({ message: t('grocery.created'), color: 'success' })
    navigate(`/lists/${result.list.id}`)
  }

  const updateGroceryList = async (listId: string, choices?: GroceryUpdateChoices) => {
    const result = await groceryService.updateFromPlan(listId, choices)
    if (!result.ok) {
      notifications.show({
        message: t('grocery.updateFailed', { error: result.error }),
        color: 'error',
      })
      return
    }
    notifications.show({ message: t('grocery.updated'), color: 'success' })
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
    if (!previewResult.ok) {
      notifications.show({
        message: `Could not preview list update (${previewResult.error})`,
        color: 'error',
      })
      return
    }
    modals.open({
      title: t('grocery.updateTitle'),
      children: (
        <GroceryUpdatePreview
          listTitle={existing.title}
          revisionDrift={revisionDrift}
          preview={previewResult.preview}
          onUpdate={(choices) => {
            modals.closeAll()
            void updateGroceryList(existing.id, choices)
          }}
          onCreateNew={() => {
            modals.closeAll()
            void createGroceryList()
          }}
        />
      ),
    })
  }

  if (loading) {
    return (
      <Stack gap="md" align="center" py="xl">
        <Loader size="sm" />
        <Text c="dimmed">{t('plan.loading')}</Text>
      </Stack>
    )
  }

  if (!graph || !settings) {
    return (
      <Stack gap="md">
        <PageTitle>{t('plan.title')}</PageTitle>
        <Text c="dimmed">{t('plan.loadFailed')}</Text>
      </Stack>
    )
  }

  const endDate = addDays(graph.plan.startDate, 6)
  const thisWeekStart = startOfWeek(today, settings.weekStartDay)
  const isHistoryWeek = graph.plan.startDate < thisWeekStart
  const accent = isHistoryWeek ? 'gray' : 'primary'
  const units = effortUnitsForDate(graph, activeDay)
  const prepLabel = units > 0 ? t('plan.prepUnits', { units: formatEffortUnits(units) }) : null
  const dayEvents = cookingEventsOnDate(graph, activeDay)
  const dayPrompts = softPrompts.filter((p) => p.date === activeDay)
  const weekPrompts = softPrompts.filter((p) => !p.date)
  const label = formatPlanWeekLabel(
    planWeekRelation(graph.plan.startDate, today, settings.weekStartDay),
    bcp47,
    t,
  )
  const remainingThisWeek = graph.cookingEvents
    .map((event) => ({
      id: event.id,
      name: event.recipeSnapshot.name,
      remaining: planService.remainingForCookingEvent(graph, event.id),
      carryoverRisk: isCarryoverRisk(event.recipeSnapshot.reusePolicy),
      scheduledDate: event.scheduledDate,
    }))
    .filter((row) => hasUnallocatedRemainder(row.remaining))
  const wontCarryOverEventIds = new Set(
    remainingThisWeek
      .filter((row) => row.carryoverRisk && row.scheduledDate === activeDay)
      .map((row) => row.id),
  )

  const groceryAction = (
    <Button
      variant="default"
      radius="xl"
      size="compact-sm"
      leftSection={<ShoppingBag size={15} />}
      onClick={() => void handleGenerateGroceries()}
    >
      {t('grocery.generate')}
    </Button>
  )

  const generateMealsAction = (
    <Button
      variant="default"
      radius="xl"
      size="compact-sm"
      leftSection={<MagicWand size={15} />}
      onClick={() => setGenerateMealsOpen(true)}
    >
      {t('generation.weekGenerate')}
    </Button>
  )

  return (
    <Stack gap="lg">
      {viewMode === 'week' ? (
        <PageTitle
          actions={
            <Group gap="xs" wrap="nowrap">
              {isHistoryWeek ? (
                <Badge color="gray" variant="light" radius="xl">
                  {t('week.history')}
                </Badge>
              ) : null}
              {groceryAction}
              {generateMealsAction}
            </Group>
          }
        >
          {t('plan.title')}
        </PageTitle>
      ) : (
        <Group justify="space-between" align="center" wrap="nowrap">
          <Button
            variant="default"
            radius="xl"
            size="compact-sm"
            leftSection={<CaretLeft size={15} />}
            onClick={() => setViewMode('week')}
          >
            {t('plan.backToWeek')}
          </Button>
          <Group gap="xs" wrap="nowrap">
            {isHistoryWeek ? (
              <Badge color="gray" variant="light" radius="xl">
                {t('week.history')}
              </Badge>
            ) : null}
            {groceryAction}
            {generateMealsAction}
          </Group>
        </Group>
      )}

      <Group justify="space-between" align="center">
        <ActionIcon
          variant="default"
          radius="xl"
          size={32}
          aria-label={t('week.prev')}
          onClick={() => void goToAdjacentWeek(-1)}
        >
          <CaretLeft size={18} />
        </ActionIcon>
        <UnstyledButton
          onClick={toggleCalendar}
          px={10}
          py={6}
          style={{ borderRadius: 999 }}
          aria-expanded={calendarOpen}
          aria-label={t('week.calendar')}
        >
          <Group gap={6} justify="center">
            <Calendar size={15} style={isHistoryWeek ? { opacity: 0.55 } : undefined} />
            <Stack gap={0} align="center">
              <Text fw={600} size="sm" c={isHistoryWeek ? 'dimmed' : undefined}>
                {label}
              </Text>
              <Text size="xs" c="dimmed">
                {graph.plan.startDate} – {endDate} · {graph.plan.peopleCount} people
              </Text>
            </Stack>
            {calendarOpen ? <CaretUp size={14} /> : <CaretDown size={14} />}
          </Group>
        </UnstyledButton>
        <ActionIcon
          variant="default"
          radius="xl"
          size={32}
          aria-label={t('week.nextNav')}
          onClick={() => void goToAdjacentWeek(1)}
        >
          <CaretRight size={18} />
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

      {viewMode === 'week' ? (
        <Stack gap="md">
          <SoftPromptAlerts prompts={weekPrompts} />
          <PlanWeekGrid
            weekDates={weekDates}
            today={today}
            displaysByDate={displaysByDate}
            remainingByEventId={remainingByEventId}
            onSelectDay={openDay}
            onAddDish={(slot) => setEditorSlot(slot)}
          />
        </Stack>
      ) : (
        <>
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
                  aria-label={`${shortWeekday(date, bcp47)} ${dayNumber(date)}, ${planned ? t('plan.dayPlanned') : t('plan.dayEmpty')}`}
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
              {remainingThisWeek.map((row) =>
                row.carryoverRisk ? (
                  <Tooltip key={row.id} label={t('plan.sameDayTooltip')} multiline w={240}>
                    <Badge
                      variant="light"
                      color="warning"
                      radius="xl"
                      size="sm"
                      leftSection={<Warning size={12} />}
                    >
                      {row.name} · {formatQty(row.remaining)} {t('quantity.left')} ·{' '}
                      {t('plan.sameDayOnly')}
                    </Badge>
                  </Tooltip>
                ) : (
                  <Badge key={row.id} variant="light" color={accent} radius="xl" size="sm">
                    {row.name} · {formatQty(row.remaining)} {t('quantity.remaining')}
                  </Badge>
                ),
              )}
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
                      {t('slot.noSlot')}
                    </Text>
                  )
                }
                return meals.map((display) => (
                  <MealSlotCard
                    key={display.slot.id}
                    display={display}
                    wontCarryOverEventIds={wontCarryOverEventIds}
                    onOpen={() => setEditorSlot(display.slot)}
                    onClear={() => void confirmClearSlot(planService, display.slot.id, t)}
                    onExclude={() => void confirmExcludeSlot(planService, display.slot.id, t)}
                    onUnexclude={() => void handleUnexclude(display.slot.id)}
                    onGenerate={
                      display.components.length === 0 && !display.slot.excluded
                        ? () =>
                            void openGenerateMealPreview({
                              slotId: display.slot.id,
                              generationService,
                              t,
                              formatQty,
                            })
                        : undefined
                    }
                  />
                ))
              })}
            </Stack>
          </Stack>
        </>
      )}

      {editorSlot && (
        <MealEditor
          opened={!!editorSlot}
          onClose={() => setEditorSlot(undefined)}
          slot={editorSlot}
          graph={graph}
          components={editorDisplay?.components ?? []}
        />
      )}
      <Modal
        opened={generateMealsOpen}
        onClose={() => setGenerateMealsOpen(false)}
        title={t('generation.weekTitle')}
        centered
      >
        <GenerateMealsModal
          key={`${graph.plan.id}-${graph.plan.revision}-${generateMealsOpen}`}
          graph={graph}
          formatQty={formatQty}
          onClose={() => setGenerateMealsOpen(false)}
        />
      </Modal>
    </Stack>
  )
}
