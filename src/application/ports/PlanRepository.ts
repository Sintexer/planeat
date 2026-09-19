import type { CookingEvent, CookingEventId, RecipeSnapshot } from '../../domain/plans/CookingEvent'
import type { MealComponent, MealComponentId } from '../../domain/plans/MealComponent'
import type { MealSlot, MealSlotId } from '../../domain/plans/MealSlot'
import type { Plan, PlanId } from '../../domain/plans/Plan'
import type { PlanGraph } from '../../domain/plans/PlanGraph'
import type { LocalDate } from '../../domain/shared/LocalDate'
import type { Quantity } from '../../domain/shared/Quantity'
import type { RecipeRole } from '../../domain/shared/MealEnums'
import type { SimpleFoodId } from '../../domain/simpleFoods/SimpleFood'
import type { RecipeId } from '../../domain/recipes/Recipe'
import type { MealType } from '../../domain/shared/MealEnums'

export interface AddCookingEventComponentInput {
  slotId: MealSlotId
  recipeId: RecipeId
  recipeSnapshot: RecipeSnapshot
  outputQuantity: Quantity
  allocatedQuantity: Quantity
  role?: RecipeRole
  scheduledDate: LocalDate
  cookingEventId?: CookingEventId
}

export interface LinkCookingEventComponentInput {
  slotId: MealSlotId
  cookingEventId: CookingEventId
  allocatedQuantity: Quantity
  role?: RecipeRole
}

export interface AddSimpleFoodComponentInput {
  slotId: MealSlotId
  simpleFoodId: SimpleFoodId
  allocatedQuantity: Quantity
  role?: RecipeRole
}

export type AddGeneratedComponentInput =
  | ({ kind: 'cooking-event' } & AddCookingEventComponentInput)
  | ({ kind: 'simple-food' } & AddSimpleFoodComponentInput)
  | ({ kind: 'link-cooking-event' } & LinkCookingEventComponentInput)

export interface CookingEventDependent {
  componentId: MealComponentId
  slotId: MealSlotId
  date: LocalDate
  mealType: MealType
}

export interface PlanRepository {
  getById(id: PlanId): Promise<Plan | undefined>
  getByStartDate(startDate: LocalDate): Promise<Plan | undefined>
  getGraph(id: PlanId): Promise<PlanGraph | undefined>
  createPlanWithSlots(plan: Plan, slots: MealSlot[]): Promise<void>
  getSlot(slotId: MealSlotId): Promise<MealSlot | undefined>
  setSlotExcluded(slotId: MealSlotId, excluded: boolean): Promise<void>
  setSlotGenerationLocked(slotId: MealSlotId, locked: boolean): Promise<void>

  addCookingEventComponent(
    planId: PlanId,
    input: AddCookingEventComponentInput,
  ): Promise<MealComponent>
  addCookingEventComponents(
    planId: PlanId,
    inputs: AddCookingEventComponentInput[],
  ): Promise<MealComponent[]>
  linkCookingEventComponent(
    planId: PlanId,
    input: LinkCookingEventComponentInput,
  ): Promise<MealComponent>
  addSimpleFoodComponent(planId: PlanId, input: AddSimpleFoodComponentInput): Promise<MealComponent>
  addGeneratedComponents(
    planId: PlanId,
    inputs: AddGeneratedComponentInput[],
  ): Promise<MealComponent[]>
  replaceGeneratedComponents(
    planId: PlanId,
    clearSlotIds: readonly MealSlotId[],
    inputs: AddGeneratedComponentInput[],
  ): Promise<MealComponent[]>
  updateComponentAllocation(
    planId: PlanId,
    componentId: MealComponentId,
    allocatedQuantity: Quantity,
  ): Promise<void>
  removeComponent(planId: PlanId, componentId: MealComponentId): Promise<void>
  updateCookingEvent(
    planId: PlanId,
    eventId: CookingEventId,
    patch: { outputQuantity?: Quantity; scheduledDate?: LocalDate },
  ): Promise<void>
  listCookingEventDependents(eventId: CookingEventId): Promise<CookingEventDependent[]>
  getComponent(componentId: MealComponentId): Promise<MealComponent | undefined>

  clearSlot(planId: PlanId, slotId: MealSlotId): Promise<void>
  bumpRevision(planId: PlanId): Promise<void>
  listComponentsForSlot(slotId: MealSlotId): Promise<MealComponent[]>
  getCookingEvent(id: CookingEventId): Promise<CookingEvent | undefined>
}
