import type { PlanGraph } from '../../domain/plans/PlanGraph'
import type { LocalDate } from '../../domain/shared/LocalDate'
import type { MealType } from '../../domain/shared/MealEnums'
import type { SimpleFood } from '../../domain/simpleFoods/SimpleFood'
import type { SlotDisplay } from '../components/MealSlotCard'
import { MEAL_TYPES } from '../../domain/shared/MealEnums'

export function buildSlotDisplays(
  graph: PlanGraph,
  simpleFoodsById: Map<string, SimpleFood>,
  date?: LocalDate,
): SlotDisplay[] {
  const slots = date ? graph.slots.filter((s) => s.date === date) : graph.slots

  const sorted = [...slots].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return MEAL_TYPES.indexOf(a.mealType) - MEAL_TYPES.indexOf(b.mealType)
  })

  return sorted.map((slot) => {
    const component = graph.components.find((c) => c.slotId === slot.id)
    let cookingEvent = undefined
    let simpleFood = undefined
    if (component?.source.type === 'cooking-event') {
      const eventId = component.source.cookingEventId
      cookingEvent = graph.cookingEvents.find((e) => e.id === eventId)
    } else if (component?.source.type === 'simple-food') {
      simpleFood = simpleFoodsById.get(component.source.simpleFoodId)
    }
    return { slot, component, cookingEvent, simpleFood }
  })
}

export function groupDisplaysByDate(displays: SlotDisplay[]): Map<LocalDate, SlotDisplay[]> {
  const map = new Map<LocalDate, SlotDisplay[]>()
  for (const display of displays) {
    const list = map.get(display.slot.date) ?? []
    list.push(display)
    map.set(display.slot.date, list)
  }
  return map
}

export function formatPlanDayHeading(date: LocalDate): string {
  const [y, m, d] = date.split('-').map(Number)
  const weekday = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short' })
  return `${weekday} ${date}`
}

export type { MealType }
