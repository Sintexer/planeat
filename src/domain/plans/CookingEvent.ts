import type { Recipe, RecipeId } from '../recipes/Recipe'
import type { LocalDate } from '../shared/LocalDate'
import type { Quantity } from '../shared/Quantity'
import type { PlanId } from './Plan'
import type { PrepSessionId } from './PrepSession'

export type CookingEventId = string

/**
 * A frozen historical copy of a Recipe, taken at cook time. `tags` holds the tag
 * *label strings* as they were then — never live tag IDs — so a later tag rename
 * (or hypothetical delete) can never retroactively change what history shows.
 */
export type RecipeSnapshot = Omit<Recipe, 'tagIds'> & { tags: string[] }

export interface CookingEvent {
  id: CookingEventId
  planId: PlanId
  sessionId: PrepSessionId
  recipeId: RecipeId
  recipeSnapshot: RecipeSnapshot
  outputQuantity: Quantity
  scheduledDate: LocalDate
}
