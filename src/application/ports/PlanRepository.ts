import type { CookingEvent } from '../../domain/plans/CookingEvent'
import type { MealComponent } from '../../domain/plans/MealComponent'
import type { MealSlot, MealSlotId } from '../../domain/plans/MealSlot'
import type { Plan, PlanId } from '../../domain/plans/Plan'
import type { PlanGraph } from '../../domain/plans/PlanGraph'
import type { LocalDate } from '../../domain/shared/LocalDate'
import type { Recipe } from '../../domain/recipes/Recipe'
import type { Quantity } from '../../domain/shared/Quantity'
import type { RecipeRole } from '../../domain/shared/MealEnums'
import type { SimpleFoodId } from '../../domain/simpleFoods/SimpleFood'
import type { RecipeId } from '../../domain/recipes/Recipe'

export interface PlaceRecipeInput {
  slotId: MealSlotId
  recipeId: RecipeId
  recipeSnapshot: Recipe
  outputQuantity: Quantity
  allocatedQuantity: Quantity
  role?: RecipeRole
  scheduledDate: LocalDate
}

export interface PlaceSimpleFoodInput {
  slotId: MealSlotId
  simpleFoodId: SimpleFoodId
  allocatedQuantity: Quantity
  role?: RecipeRole
}

export interface PlanRepository {
  getById(id: PlanId): Promise<Plan | undefined>
  getByStartDate(startDate: LocalDate): Promise<Plan | undefined>
  getGraph(id: PlanId): Promise<PlanGraph | undefined>
  createPlanWithSlots(plan: Plan, slots: MealSlot[]): Promise<void>
  getSlot(slotId: MealSlotId): Promise<MealSlot | undefined>
  setSlotExcluded(slotId: MealSlotId, excluded: boolean): Promise<void>
  /** Clears components (and orphaned cooking events) for the slot, then places a recipe. */
  placeRecipe(planId: PlanId, input: PlaceRecipeInput): Promise<void>
  /** Clears components (and orphaned cooking events) for the slot, then places a simple food. */
  placeSimpleFood(planId: PlanId, input: PlaceSimpleFoodInput): Promise<void>
  clearSlot(planId: PlanId, slotId: MealSlotId): Promise<void>
  bumpRevision(planId: PlanId): Promise<void>
  listComponentsForSlot(slotId: MealSlotId): Promise<MealComponent[]>
  getCookingEvent(id: string): Promise<CookingEvent | undefined>
}
