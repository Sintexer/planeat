import type { Recipe, RecipeId } from '../recipes/Recipe'
import type { LocalDate } from '../shared/LocalDate'
import type { Quantity } from '../shared/Quantity'
import type { PlanId } from './Plan'
import type { PrepSessionId } from './PrepSession'

export type CookingEventId = string

export interface CookingEvent {
  id: CookingEventId
  planId: PlanId
  sessionId: PrepSessionId
  recipeId: RecipeId
  recipeSnapshot: Recipe
  outputQuantity: Quantity
  scheduledDate: LocalDate
}
