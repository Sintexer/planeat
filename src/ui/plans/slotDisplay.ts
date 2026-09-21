import type { PlanGraph } from '../../domain/plans/PlanGraph'
import { hasUnallocatedRemainder } from '../../domain/plans/CookingEventAllocation'
import type { CookingEvent } from '../../domain/plans/CookingEvent'
import type { MealComponent } from '../../domain/plans/MealComponent'
import type { MealSlot } from '../../domain/plans/MealSlot'
import type { Recipe } from '../../domain/recipes/Recipe'
import type { LocalDate } from '../../domain/shared/LocalDate'
import { MEAL_TYPES } from '../../domain/shared/MealEnums'
import type { Quantity } from '../../domain/shared/Quantity'
import type { SimpleFood } from '../../domain/simpleFoods/SimpleFood'

export { formatPlanDayHeading } from '../localization/formatDate'

export interface SlotComponentDisplay {
  component: MealComponent
  cookingEvent: CookingEvent | undefined
  simpleFood: SimpleFood | undefined
  photoUrl?: string
}

export interface SlotDisplay {
  slot: MealSlot
  components: SlotComponentDisplay[]
}

export function buildSlotDisplays(
  graph: PlanGraph,
  simpleFoodsById: Map<string, SimpleFood>,
  date?: LocalDate,
  recipesById?: Map<string, Recipe>,
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
      let photoUrl: string | undefined
      if (component.source.type === 'cooking-event') {
        const eventId = component.source.cookingEventId
        cookingEvent = graph.cookingEvents.find((e) => e.id === eventId)
        if (cookingEvent) {
          photoUrl =
            recipesById?.get(cookingEvent.recipeId)?.photoUrl ??
            cookingEvent.recipeSnapshot.photoUrl
        }
      } else if (component.source.type === 'simple-food') {
        const foodId = component.source.simpleFoodId
        simpleFood = simpleFoodsById.get(foodId)
      }
      return { component, cookingEvent, simpleFood, photoUrl }
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

export function componentLabel(item: SlotComponentDisplay, unknownLabel = ''): string {
  if (item.cookingEvent) return item.cookingEvent.recipeSnapshot.name
  if (item.simpleFood) return item.simpleFood.name
  return unknownLabel
}

/**
 * Whether this dish is where a batch was cooked ('prep') or is eating from one cooked
 * elsewhere ('reuse'). Ground truth via `originSlotId` when present; for events that predate
 * that field, falls back to the old same-day-blind heuristic (date comparison + remainder).
 */
export function dishMarker(
  item: SlotComponentDisplay,
  slot: MealSlot,
  remainingByEventId: ReadonlyMap<string, Quantity | null>,
): 'prep' | 'reuse' | null {
  const event = item.cookingEvent
  if (!event) return null
  if (event.originSlotId !== undefined) {
    return event.originSlotId === slot.id ? 'prep' : 'reuse'
  }
  if (event.scheduledDate !== slot.date) return 'reuse'
  return hasUnallocatedRemainder(remainingByEventId.get(event.id) ?? null) ? 'prep' : null
}

export type { MealType } from '../../domain/shared/MealEnums'
