import type { CookingEvent } from './CookingEvent'
import type { MealComponent } from './MealComponent'
import type { MealSlot } from './MealSlot'
import type { Plan } from './Plan'

/** Plan plus related rows for UI rendering. */
export interface PlanGraph {
  plan: Plan
  slots: MealSlot[]
  components: MealComponent[]
  cookingEvents: CookingEvent[]
}
