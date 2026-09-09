import type { PlanGraph } from '../../domain/plans/PlanGraph'
import type { CookingEvent } from '../../domain/plans/CookingEvent'
import type { MealComponent } from '../../domain/plans/MealComponent'
import type { MealSlot } from '../../domain/plans/MealSlot'
import type { LocalDate } from '../../domain/shared/LocalDate'
import type { SimpleFood } from '../../domain/simpleFoods/SimpleFood'
import { MEAL_TYPES } from '../../domain/shared/MealEnums'

export interface SlotComponentDisplay {
  component: MealComponent
  cookingEvent: CookingEvent | undefined
  simpleFood: SimpleFood | undefined
}

export interface SlotDisplay {
  slot: MealSlot
  components: SlotComponentDisplay[]
}

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
    const slotComponents = graph.components.filter((c) => c.slotId === slot.id)
    const components: SlotComponentDisplay[] = slotComponents.map((component) => {
      let cookingEvent: CookingEvent | undefined
      let simpleFood: SimpleFood | undefined
      if (component.source.type === 'cooking-event') {
        const eventId = component.source.cookingEventId
        cookingEvent = graph.cookingEvents.find((e) => e.id === eventId)
      } else if (component.source.type === 'simple-food') {
        const foodId = component.source.simpleFoodId
        simpleFood = simpleFoodsById.get(foodId)
      }
      return { component, cookingEvent, simpleFood }
    })
    return { slot, components }
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

export function componentLabel(item: SlotComponentDisplay): string {
  if (item.cookingEvent) return item.cookingEvent.recipeSnapshot.name
  if (item.simpleFood) return item.simpleFood.name
  return 'Unknown item'
}

export type { MealType } from '../../domain/shared/MealEnums'
