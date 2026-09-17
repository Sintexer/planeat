import type { PlanGraph } from './PlanGraph'
import { cookingEventsOnDate, effortUnitsForDate } from './prepDaySummary'
import { providesVegetable } from './componentSuggestions'
import type { Settings } from '../shared/Settings'
import { addDays, weekdayOf, type LocalDate } from '../shared/LocalDate'
import { formatEffortUnits } from './prepEffort'
import type { MealType } from '../shared/MealEnums'

export interface SoftPrompt {
  id: string
  date?: LocalDate
  message: string
  severity: 'info' | 'warning'
}

function componentSignature(graph: PlanGraph, slotId: string): string {
  const parts: string[] = []
  for (const component of graph.components) {
    if (component.slotId !== slotId) continue
    const source = component.source
    if (source.type === 'cooking-event') {
      const event = graph.cookingEvents.find((e) => e.id === source.cookingEventId)
      parts.push(`ce:${event?.recipeId ?? source.cookingEventId}`)
    } else {
      parts.push(`sf:${source.simpleFoodId}`)
    }
  }
  return parts.sort().join('|')
}

function dayHasVegetable(graph: PlanGraph, date: LocalDate): boolean {
  const slotIds = new Set(
    graph.slots.filter((s) => s.date === date && !s.excluded).map((s) => s.id),
  )
  let hasMeal = false
  for (const component of graph.components) {
    if (!slotIds.has(component.slotId)) continue
    hasMeal = true
    if (component.role === 'vegetable') return true
    const source = component.source
    if (source.type === 'cooking-event') {
      const event = graph.cookingEvents.find((e) => e.id === source.cookingEventId)
      if (event && providesVegetable(event.recipeSnapshot.roles, event.recipeSnapshot.tags)) {
        return true
      }
    }
  }
  return hasMeal ? false : true // empty day: no veg prompt
}

function slotKeyItem(graph: PlanGraph, date: LocalDate, mealType: MealType): string | null {
  const slot = graph.slots.find((s) => s.date === date && s.mealType === mealType && !s.excluded)
  if (!slot) return null
  const comps = graph.components.filter((c) => c.slotId === slot.id)
  if (comps.length === 0) return null
  return componentSignature(graph, slot.id)
}

export function evaluatePlanSoftPrompts(
  graph: PlanGraph,
  settings: Settings,
  previousWeekRecipeIds: Set<string> = new Set(),
): SoftPrompt[] {
  const prompts: SoftPrompt[] = []
  const dates = [...new Set(graph.slots.map((s) => s.date))].sort()

  for (const date of dates) {
    const units = effortUnitsForDate(graph, date)
    if (units > settings.maxBatchPrepUnits) {
      prompts.push({
        id: `max-units-${date}`,
        date,
        severity: 'warning',
        message: `${date}: prep effort (${formatEffortUnits(units)}) is above your max batch-prep units (${formatEffortUnits(settings.maxBatchPrepUnits)}).`,
      })
    }

    const events = cookingEventsOnDate(graph, date)
    const demandingCount = events.filter((e) => e.recipeSnapshot.effort === 'demanding').length
    if (settings.avoidMultipleDemandingPreps && demandingCount >= 2) {
      prompts.push({
        id: `demanding-${date}`,
        date,
        severity: 'warning',
        message: `${date}: multiple demanding preparations on this day.`,
      })
    }

    const weekday = weekdayOf(date)
    if (settings.quickMealsOnlyDays.includes(weekday)) {
      const nonQuick = events.filter((e) => e.recipeSnapshot.effort !== 'quick')
      if (nonQuick.length > 0) {
        prompts.push({
          id: `quick-only-${date}`,
          date,
          severity: 'warning',
          message: `${date}: non-quick prep on a quick-meals-only day.`,
        })
      }
    }

    if (
      settings.preferredBatchPrepDays.length > 0 &&
      events.length > 0 &&
      !settings.preferredBatchPrepDays.includes(weekday)
    ) {
      prompts.push({
        id: `preferred-prep-${date}`,
        date,
        severity: 'info',
        message: `${date}: prep scheduled outside your preferred batch-prep days.`,
      })
    }

    if (settings.favorVegetablesDaily && !dayHasVegetable(graph, date)) {
      const hasAnyComponent = graph.slots.some(
        (s) => s.date === date && !s.excluded && graph.components.some((c) => c.slotId === s.id),
      )
      if (hasAnyComponent) {
        prompts.push({
          id: `veg-${date}`,
          date,
          severity: 'info',
          message: `${date}: Add vegetables?`,
        })
      }
    }
  }

  const breakfastKeys = dates
    .map((date) => slotKeyItem(graph, date, 'breakfast'))
    .filter((k): k is string => !!k)
  const breakfastCounts = new Map<string, number>()
  for (const key of breakfastKeys) {
    breakfastCounts.set(key, (breakfastCounts.get(key) ?? 0) + 1)
  }
  for (const [key, count] of breakfastCounts) {
    if (count >= 2) {
      prompts.push({
        id: `breakfast-repeat-${key}`,
        severity: 'warning',
        message: 'Same breakfast is repeated within this plan.',
      })
      break
    }
  }

  for (let i = 0; i < dates.length - 1; i++) {
    const a = slotKeyItem(graph, dates[i], 'dinner')
    const b = slotKeyItem(graph, dates[i + 1], 'dinner')
    if (a && b && a === b) {
      prompts.push({
        id: `identical-dinner-${dates[i]}-${dates[i + 1]}`,
        severity: 'warning',
        message: `Identical dinners on consecutive days (${dates[i]} and ${dates[i + 1]}).`,
      })
    }
  }

  if (previousWeekRecipeIds.size > 0) {
    const reused = graph.cookingEvents.filter((e) => previousWeekRecipeIds.has(e.recipeId))
    const names = [...new Set(reused.map((e) => e.recipeSnapshot.name))]
    if (names.length > 0) {
      prompts.push({
        id: 'previous-week-reuse',
        severity: 'info',
        message: `Used last week — consider an alternative: ${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}.`,
      })
    }
  }

  return prompts
}

export function previousWeekStart(planStart: LocalDate): LocalDate {
  return addDays(planStart, -7)
}
