import type { Recipe, RecipeId } from '../recipes/Recipe'
import type { LocalDate } from '../shared/LocalDate'
import type { Quantity } from '../shared/Quantity'
import type { PlanId } from './Plan'

export type CookingEventId = string

export interface CookingEvent {
  id: CookingEventId
  planId: PlanId
  /** Prep sessions remain deferred; always null for now. */
  sessionId: null
  recipeId: RecipeId
  recipeSnapshot: Recipe
  outputQuantity: Quantity
  scheduledDate: LocalDate
}
