import type { RecipeRole } from '../shared/MealEnums'
import type { Quantity } from '../shared/Quantity'
import type { SimpleFoodId } from '../simpleFoods/SimpleFood'
import type { CookingEventId } from './CookingEvent'
import type { MealSlotId } from './MealSlot'

export type MealComponentId = string

export type ComponentSource =
  | { type: 'cooking-event'; cookingEventId: CookingEventId }
  | { type: 'simple-food'; simpleFoodId: SimpleFoodId }

export interface MealComponent {
  id: MealComponentId
  slotId: MealSlotId
  source: ComponentSource
  allocatedQuantity: Quantity
  role?: RecipeRole
}
