import type { PlanRepository } from '../ports/PlanRepository'
import type { RecipeRepository } from '../ports/RecipeRepository'
import type { SettingsRepository } from '../ports/SettingsRepository'
import type { SimpleFoodRepository } from '../ports/SimpleFoodRepository'
import type { QuantityService } from '../quantities/QuantityService'
import type { MealSlot, MealSlotId } from '../../domain/plans/MealSlot'
import type { Plan, PlanId } from '../../domain/plans/Plan'
import type { PlanGraph } from '../../domain/plans/PlanGraph'
import { MEAL_TYPES } from '../../domain/shared/MealEnums'
import {
  addDays,
  enumeratePlanDates,
  startOfWeek,
  type LocalDate,
} from '../../domain/shared/LocalDate'
import type { RecipeId } from '../../domain/recipes/Recipe'
import type { SimpleFoodId } from '../../domain/simpleFoods/SimpleFood'

export type PlanError =
  'not-found' | 'slot-not-found' | 'recipe-not-found' | 'simple-food-not-found' | 'invalid-quantity'

export class PlanService {
  private readonly plans: PlanRepository
  private readonly recipes: RecipeRepository
  private readonly simpleFoods: SimpleFoodRepository
  private readonly settings: SettingsRepository
  private readonly quantities: QuantityService

  constructor(
    plans: PlanRepository,
    recipes: RecipeRepository,
    simpleFoods: SimpleFoodRepository,
    settings: SettingsRepository,
    quantities: QuantityService,
  ) {
    this.plans = plans
    this.recipes = recipes
    this.simpleFoods = simpleFoods
    this.settings = settings
    this.quantities = quantities
  }

  getPlan(id: PlanId): Promise<PlanGraph | undefined> {
    return this.plans.getGraph(id)
  }

  async getPlanByStartDate(startDate: LocalDate): Promise<PlanGraph | undefined> {
    const plan = await this.plans.getByStartDate(startDate)
    if (!plan) return undefined
    return this.plans.getGraph(plan.id)
  }

  async getOrCreatePlanForWeek(
    anchorDate: LocalDate,
  ): Promise<{ ok: true; graph: PlanGraph } | { ok: false; error: PlanError }> {
    const settings = await this.settings.get()
    const weekStart = startOfWeek(anchorDate, settings.weekStartDay)

    const existing = await this.plans.getByStartDate(weekStart)
    if (existing) {
      const graph = await this.plans.getGraph(existing.id)
      if (!graph) return { ok: false, error: 'not-found' }
      return { ok: true, graph }
    }

    const now = Date.now()
    const plan: Plan = {
      id: crypto.randomUUID(),
      startDate: weekStart,
      dayCount: 7,
      peopleCount: settings.householdSize,
      revision: 0,
      preferences: {},
      createdAt: now,
      updatedAt: now,
    }

    const dates = enumeratePlanDates(weekStart, 7)
    const slots: MealSlot[] = []
    for (const date of dates) {
      for (const mealType of MEAL_TYPES) {
        slots.push({
          id: crypto.randomUUID(),
          planId: plan.id,
          date,
          mealType,
          excluded: false,
        })
      }
    }

    await this.plans.createPlanWithSlots(plan, slots)
    const graph = await this.plans.getGraph(plan.id)
    if (!graph) return { ok: false, error: 'not-found' }
    return { ok: true, graph }
  }

  async setSlotExcluded(
    slotId: MealSlotId,
    excluded: boolean,
  ): Promise<{ ok: true } | { ok: false; error: PlanError }> {
    const slot = await this.plans.getSlot(slotId)
    if (!slot) return { ok: false, error: 'slot-not-found' }

    if (excluded) {
      await this.plans.clearSlot(slot.planId, slotId)
      await this.plans.setSlotExcluded(slotId, true)
      // clearSlot already bumped revision; setExcluded alone doesn't — but clear did.
      // If slot was already empty, clear still bumps. Good.
    } else {
      await this.plans.setSlotExcluded(slotId, false)
      await this.plans.bumpRevision(slot.planId)
    }
    return { ok: true }
  }

  async placeRecipe(
    slotId: MealSlotId,
    recipeId: RecipeId,
  ): Promise<{ ok: true } | { ok: false; error: PlanError }> {
    const slot = await this.plans.getSlot(slotId)
    if (!slot) return { ok: false, error: 'slot-not-found' }

    const plan = await this.plans.getById(slot.planId)
    if (!plan) return { ok: false, error: 'not-found' }

    const recipe = await this.recipes.getById(recipeId)
    if (!recipe) return { ok: false, error: 'recipe-not-found' }

    const outputQuantity = this.quantities.scale(recipe.defaultPortionPerPerson, plan.peopleCount)
    if (!outputQuantity || !Number.isFinite(outputQuantity.value) || outputQuantity.value <= 0) {
      return { ok: false, error: 'invalid-quantity' }
    }

    const primaryRole = recipe.roles[0]

    await this.plans.placeRecipe(plan.id, {
      slotId,
      recipeId: recipe.id,
      recipeSnapshot: recipe,
      outputQuantity,
      allocatedQuantity: outputQuantity,
      role: primaryRole,
      scheduledDate: slot.date,
    })
    return { ok: true }
  }

  async placeSimpleFood(
    slotId: MealSlotId,
    simpleFoodId: SimpleFoodId,
  ): Promise<{ ok: true } | { ok: false; error: PlanError }> {
    const slot = await this.plans.getSlot(slotId)
    if (!slot) return { ok: false, error: 'slot-not-found' }

    const plan = await this.plans.getById(slot.planId)
    if (!plan) return { ok: false, error: 'not-found' }

    const simpleFood = await this.simpleFoods.getById(simpleFoodId)
    if (!simpleFood) return { ok: false, error: 'simple-food-not-found' }

    const allocatedQuantity = this.quantities.scale(simpleFood.defaultPortion, plan.peopleCount)
    if (
      !allocatedQuantity ||
      !Number.isFinite(allocatedQuantity.value) ||
      allocatedQuantity.value <= 0
    ) {
      return { ok: false, error: 'invalid-quantity' }
    }

    await this.plans.placeSimpleFood(plan.id, {
      slotId,
      simpleFoodId: simpleFood.id,
      allocatedQuantity,
      role: simpleFood.roles[0],
    })
    return { ok: true }
  }

  async clearSlot(slotId: MealSlotId): Promise<{ ok: true } | { ok: false; error: PlanError }> {
    const slot = await this.plans.getSlot(slotId)
    if (!slot) return { ok: false, error: 'slot-not-found' }
    await this.plans.clearSlot(slot.planId, slotId)
    return { ok: true }
  }

  /** Neighbor week start date for prev/next navigation. */
  adjacentWeekStart(startDate: LocalDate, direction: -1 | 1): LocalDate {
    return addDays(startDate, direction * 7)
  }
}
