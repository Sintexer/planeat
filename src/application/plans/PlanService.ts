import type {
  AddCookingEventComponentInput,
  AddGeneratedComponentInput,
  CookingEventDependent,
  PlanRepository,
} from '../ports/PlanRepository'
import type { RecipeRepository } from '../ports/RecipeRepository'
import type { SettingsRepository } from '../ports/SettingsRepository'
import type { SimpleFoodRepository } from '../ports/SimpleFoodRepository'
import type { TagRepository } from '../ports/TagRepository'
import type { QuantityService } from '../quantities/QuantityService'
import type { MealSlot, MealSlotId } from '../../domain/plans/MealSlot'
import type { MealComponent, MealComponentId } from '../../domain/plans/MealComponent'
import type { CookingEvent, CookingEventId, RecipeSnapshot } from '../../domain/plans/CookingEvent'
import type { Plan, PlanId } from '../../domain/plans/Plan'
import type { PlanGraph } from '../../domain/plans/PlanGraph'
import {
  checkReusePolicy,
  componentsForCookingEvent,
  listEligibleCookingEvents,
  remainingSameUnit,
} from '../../domain/plans/CookingEventAllocation'
import { MEAL_TYPES, type RecipeRole } from '../../domain/shared/MealEnums'
import {
  addDays,
  enumeratePlanDates,
  startOfWeek,
  type LocalDate,
} from '../../domain/shared/LocalDate'
import type { Quantity } from '../../domain/shared/Quantity'
import type { RecipeId } from '../../domain/recipes/Recipe'
import type { SimpleFoodId } from '../../domain/simpleFoods/SimpleFood'
import type { FavoriteComponent } from '../../domain/favorites/MealFavorite'
import type { GeneratedComponent } from '../../domain/plans/generation/proposal'

export type PlanError =
  | 'not-found'
  | 'slot-not-found'
  | 'recipe-not-found'
  | 'simple-food-not-found'
  | 'cooking-event-not-found'
  | 'component-not-found'
  | 'invalid-quantity'
  | 'over-allocated'
  | 'reuse-forbidden'
  | 'before-prep'
  | 'incompatible-quantity'
  | 'favorite-missing-ref'

export type PlanResult<T = void> = { ok: true; value: T } | { ok: false; error: PlanError }

export interface AddNewCookingEventOptions {
  outputQuantity?: Quantity
  allocatedQuantity?: Quantity
  scheduledDate?: LocalDate
  role?: RecipeRole
}

export interface LinkExistingCookingEventOptions {
  allocatedQuantity: Quantity
  role?: RecipeRole
}

export interface AddSimpleFoodOptions {
  allocatedQuantity?: Quantity
  role?: RecipeRole
}

export class PlanService {
  private readonly plans: PlanRepository
  private readonly recipes: RecipeRepository
  private readonly simpleFoods: SimpleFoodRepository
  private readonly settings: SettingsRepository
  private readonly quantities: QuantityService
  private readonly tags: TagRepository

  constructor(
    plans: PlanRepository,
    recipes: RecipeRepository,
    simpleFoods: SimpleFoodRepository,
    settings: SettingsRepository,
    quantities: QuantityService,
    tags: TagRepository,
  ) {
    this.plans = plans
    this.recipes = recipes
    this.simpleFoods = simpleFoods
    this.settings = settings
    this.quantities = quantities
    this.tags = tags
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
    } else {
      await this.plans.setSlotExcluded(slotId, false)
      await this.plans.bumpRevision(slot.planId)
    }
    return { ok: true }
  }

  async addNewCookingEventComponent(
    slotId: MealSlotId,
    recipeId: RecipeId,
    options: AddNewCookingEventOptions = {},
  ): Promise<{ ok: true; component: MealComponent } | { ok: false; error: PlanError }> {
    const built = await this.buildCookingEventComponentInput(slotId, recipeId, options)
    if (!built.ok) return built
    const component = await this.plans.addCookingEventComponent(built.planId, built.input)
    return { ok: true, component }
  }

  async addNewCookingEventComponents(
    items: Array<{
      slotId: MealSlotId
      recipeId: RecipeId
      outputQuantity?: Quantity
      allocatedQuantity?: Quantity
    }>,
  ): Promise<{ ok: true; components: MealComponent[] } | { ok: false; error: PlanError }> {
    if (items.length === 0) return { ok: true, components: [] }
    const inputs: AddCookingEventComponentInput[] = []
    let planId: PlanId | undefined
    for (const item of items) {
      const built = await this.buildCookingEventComponentInput(item.slotId, item.recipeId, {
        outputQuantity: item.outputQuantity,
        allocatedQuantity: item.allocatedQuantity,
      })
      if (!built.ok) return built
      if (planId !== undefined && built.planId !== planId) return { ok: false, error: 'not-found' }
      planId = built.planId
      inputs.push(built.input)
    }
    if (!planId) return { ok: false, error: 'not-found' }
    const components = await this.plans.addCookingEventComponents(planId, inputs)
    return { ok: true, components }
  }

  async addGeneratedMealComponents(
    items: Array<{ slotId: MealSlotId; components: GeneratedComponent[] }>,
  ): Promise<{ ok: true; components: MealComponent[] } | { ok: false; error: PlanError }> {
    if (items.length === 0) return { ok: true, components: [] }
    const inputs: AddGeneratedComponentInput[] = []
    let planId: PlanId | undefined
    let graph: PlanGraph | undefined
    const leftoverUsed = new Map<CookingEventId, Quantity>()
    const proposedToReal = new Map<string, CookingEventId>()
    const proposedEvents = new Map<string, CookingEvent>()
    for (const item of items) {
      for (const component of item.components) {
        if (component.type === 'recipe') {
          const built = await this.buildCookingEventComponentInput(
            item.slotId,
            component.recipeId,
            {
              outputQuantity: component.outputQuantity,
              allocatedQuantity: component.allocatedQuantity,
              role: component.role,
            },
          )
          if (!built.ok) return built
          if (planId !== undefined && built.planId !== planId)
            return { ok: false, error: 'not-found' }
          planId = built.planId
          const cookingEventId = component.proposedEventId ? crypto.randomUUID() : undefined
          if (component.proposedEventId && cookingEventId) {
            proposedToReal.set(component.proposedEventId, cookingEventId)
            leftoverUsed.set(cookingEventId, component.allocatedQuantity)
            proposedEvents.set(component.proposedEventId, {
              id: cookingEventId,
              planId,
              sessionId: '',
              recipeId: component.recipeId,
              recipeSnapshot: built.input.recipeSnapshot,
              outputQuantity: component.outputQuantity,
              scheduledDate: built.input.scheduledDate,
            })
          }
          inputs.push({
            kind: 'cooking-event',
            ...built.input,
            cookingEventId,
          })
        } else if (component.type === 'leftover') {
          const ctx = await this.slotPlanContext(item.slotId)
          if (!ctx.ok) return ctx
          if (planId !== undefined && ctx.plan.id !== planId)
            return { ok: false, error: 'not-found' }
          planId = ctx.plan.id
          if (!this.isValidPositiveQuantity(component.allocatedQuantity)) {
            return { ok: false, error: 'invalid-quantity' }
          }
          const proposed = component.proposedEventId
            ? proposedEvents.get(component.proposedEventId)
            : undefined
          const realId = component.proposedEventId
            ? proposedToReal.get(component.proposedEventId)
            : component.cookingEventId
          if (!realId) return { ok: false, error: 'cooking-event-not-found' }
          graph = graph ?? (await this.plans.getGraph(planId))
          if (!graph) return { ok: false, error: 'not-found' }
          const event = proposed ?? graph.cookingEvents.find((row) => row.id === realId)
          if (!event) return { ok: false, error: 'cooking-event-not-found' }
          const reuse = checkReusePolicy(
            event.recipeSnapshot.reusePolicy,
            event.scheduledDate,
            ctx.slot.date,
          )
          if (reuse !== 'ok') return { ok: false, error: reuse }
          const already = leftoverUsed.get(event.id)
          const extra = already
            ? this.quantities.add(already, component.allocatedQuantity)
            : component.allocatedQuantity
          if (!extra) return { ok: false, error: 'incompatible-quantity' }
          const graphComponents = proposed ? [] : graph.components
          const allocCheck = this.checkAllocation(event, graphComponents, extra)
          if (allocCheck !== 'ok') return { ok: false, error: allocCheck }
          leftoverUsed.set(event.id, extra)
          inputs.push({
            kind: 'link-cooking-event',
            slotId: item.slotId,
            cookingEventId: event.id,
            allocatedQuantity: component.allocatedQuantity,
            role: component.role ?? event.recipeSnapshot.roles[0],
          })
        } else {
          const ctx = await this.slotPlanContext(item.slotId)
          if (!ctx.ok) return ctx
          if (planId !== undefined && ctx.plan.id !== planId)
            return { ok: false, error: 'not-found' }
          planId = ctx.plan.id
          const food = await this.simpleFoods.getById(component.simpleFoodId)
          if (!food) return { ok: false, error: 'simple-food-not-found' }
          if (!this.isValidPositiveQuantity(component.allocatedQuantity)) {
            return { ok: false, error: 'invalid-quantity' }
          }
          inputs.push({
            kind: 'simple-food',
            slotId: item.slotId,
            simpleFoodId: food.id,
            allocatedQuantity: component.allocatedQuantity,
            role: component.role ?? food.roles[0],
          })
        }
      }
    }
    if (!planId) return { ok: false, error: 'not-found' }
    const components = await this.plans.addGeneratedComponents(planId, inputs)
    return { ok: true, components }
  }

  async linkExistingCookingEvent(
    slotId: MealSlotId,
    cookingEventId: CookingEventId,
    options: LinkExistingCookingEventOptions,
  ): Promise<{ ok: true; component: MealComponent } | { ok: false; error: PlanError }> {
    const ctx = await this.slotPlanContext(slotId)
    if (!ctx.ok) return ctx

    const graph = await this.plans.getGraph(ctx.plan.id)
    if (!graph) return { ok: false, error: 'not-found' }

    const event = graph.cookingEvents.find((e) => e.id === cookingEventId)
    if (!event) return { ok: false, error: 'cooking-event-not-found' }

    if (!this.isValidPositiveQuantity(options.allocatedQuantity)) {
      return { ok: false, error: 'invalid-quantity' }
    }

    const reuse = checkReusePolicy(
      event.recipeSnapshot.reusePolicy,
      event.scheduledDate,
      ctx.slot.date,
    )
    if (reuse !== 'ok') return { ok: false, error: reuse }

    const allocCheck = this.checkAllocation(event, graph.components, options.allocatedQuantity)
    if (allocCheck !== 'ok') return { ok: false, error: allocCheck }

    const role = options.role ?? event.recipeSnapshot.roles[0]
    const component = await this.plans.linkCookingEventComponent(ctx.plan.id, {
      slotId,
      cookingEventId,
      allocatedQuantity: options.allocatedQuantity,
      role,
    })
    return { ok: true, component }
  }

  async addSimpleFoodComponent(
    slotId: MealSlotId,
    simpleFoodId: SimpleFoodId,
    options: AddSimpleFoodOptions = {},
  ): Promise<{ ok: true; component: MealComponent } | { ok: false; error: PlanError }> {
    const ctx = await this.slotPlanContext(slotId)
    if (!ctx.ok) return ctx

    const simpleFood = await this.simpleFoods.getById(simpleFoodId)
    if (!simpleFood) return { ok: false, error: 'simple-food-not-found' }

    const defaultQty = this.quantities.scale(simpleFood.defaultPortion, ctx.plan.peopleCount)
    const allocatedQuantity = options.allocatedQuantity ?? defaultQty
    if (!allocatedQuantity || !this.isValidPositiveQuantity(allocatedQuantity)) {
      return { ok: false, error: 'invalid-quantity' }
    }

    const role = options.role ?? simpleFood.roles[0]
    const component = await this.plans.addSimpleFoodComponent(ctx.plan.id, {
      slotId,
      simpleFoodId: simpleFood.id,
      allocatedQuantity,
      role,
    })
    return { ok: true, component }
  }

  /**
   * Validate all favorite component refs, then apply cook-new / simple-food adds.
   * All-or-nothing: no writes if any ref is missing.
   */
  async insertFavoriteComponents(
    slotId: MealSlotId,
    components: FavoriteComponent[],
  ): Promise<{ ok: true } | { ok: false; error: PlanError; missingLabel?: string }> {
    if (components.length === 0) return { ok: false, error: 'invalid-quantity' }

    for (const component of components) {
      if (component.type === 'recipe') {
        const recipe = await this.recipes.getById(component.recipeId)
        if (!recipe) {
          return { ok: false, error: 'favorite-missing-ref', missingLabel: component.recipeId }
        }
      } else {
        const food = await this.simpleFoods.getById(component.simpleFoodId)
        if (!food) {
          return {
            ok: false,
            error: 'favorite-missing-ref',
            missingLabel: component.simpleFoodId,
          }
        }
      }
    }

    for (const component of components) {
      if (component.type === 'recipe') {
        const result = await this.addNewCookingEventComponent(slotId, component.recipeId, {
          allocatedQuantity: component.allocatedQuantity,
          outputQuantity: component.allocatedQuantity,
          role: component.role,
        })
        if (!result.ok) return result
      } else {
        const result = await this.addSimpleFoodComponent(slotId, component.simpleFoodId, {
          allocatedQuantity: component.allocatedQuantity,
          role: component.role,
        })
        if (!result.ok) return result
      }
    }

    return { ok: true }
  }

  async updateComponentAllocation(
    componentId: MealComponentId,
    allocatedQuantity: Quantity,
  ): Promise<{ ok: true } | { ok: false; error: PlanError }> {
    if (!this.isValidPositiveQuantity(allocatedQuantity)) {
      return { ok: false, error: 'invalid-quantity' }
    }

    const component = await this.plans.getComponent(componentId)
    if (!component) return { ok: false, error: 'component-not-found' }

    const slot = await this.plans.getSlot(component.slotId)
    if (!slot) return { ok: false, error: 'slot-not-found' }

    const graph = await this.plans.getGraph(slot.planId)
    if (!graph) return { ok: false, error: 'not-found' }

    if (component.source.type === 'cooking-event') {
      const cookingEventId = component.source.cookingEventId
      const event = graph.cookingEvents.find((e) => e.id === cookingEventId)
      if (!event) return { ok: false, error: 'cooking-event-not-found' }

      const reuse = checkReusePolicy(
        event.recipeSnapshot.reusePolicy,
        event.scheduledDate,
        slot.date,
      )
      if (reuse !== 'ok') return { ok: false, error: reuse }

      const allocCheck = this.checkAllocation(
        event,
        graph.components,
        allocatedQuantity,
        componentId,
      )
      if (allocCheck !== 'ok') return { ok: false, error: allocCheck }
    }

    await this.plans.updateComponentAllocation(slot.planId, componentId, allocatedQuantity)
    return { ok: true }
  }

  async removeComponent(
    componentId: MealComponentId,
  ): Promise<
    | { ok: true; removedSharedEvent: boolean; dependentsLeft: CookingEventDependent[] }
    | { ok: false; error: PlanError }
  > {
    const component = await this.plans.getComponent(componentId)
    if (!component) return { ok: false, error: 'component-not-found' }

    const slot = await this.plans.getSlot(component.slotId)
    if (!slot) return { ok: false, error: 'slot-not-found' }

    let dependentsLeft: CookingEventDependent[] = []
    let removedSharedEvent = false
    if (component.source.type === 'cooking-event') {
      const dependents = await this.plans.listCookingEventDependents(
        component.source.cookingEventId,
      )
      dependentsLeft = dependents.filter((d) => d.componentId !== componentId)
      removedSharedEvent = dependentsLeft.length > 0
    }

    await this.plans.removeComponent(slot.planId, componentId)
    return { ok: true, removedSharedEvent, dependentsLeft }
  }

  async removeCookingEventEverywhere(
    cookingEventId: CookingEventId,
  ): Promise<{ ok: true } | { ok: false; error: PlanError }> {
    const event = await this.plans.getCookingEvent(cookingEventId)
    if (!event) return { ok: false, error: 'cooking-event-not-found' }

    const dependents = await this.plans.listCookingEventDependents(cookingEventId)
    for (const dep of dependents) {
      await this.plans.removeComponent(event.planId, dep.componentId)
    }
    return { ok: true }
  }

  async updateCookingEvent(
    eventId: CookingEventId,
    patch: { outputQuantity?: Quantity; scheduledDate?: LocalDate },
  ): Promise<{ ok: true } | { ok: false; error: PlanError }> {
    const event = await this.plans.getCookingEvent(eventId)
    if (!event) return { ok: false, error: 'cooking-event-not-found' }

    const graph = await this.plans.getGraph(event.planId)
    if (!graph) return { ok: false, error: 'not-found' }

    const nextOutput = patch.outputQuantity ?? event.outputQuantity
    const nextDate = patch.scheduledDate ?? event.scheduledDate

    if (patch.outputQuantity !== undefined && !this.isValidPositiveQuantity(patch.outputQuantity)) {
      return { ok: false, error: 'invalid-quantity' }
    }

    const linked = componentsForCookingEvent(graph.components, eventId)
    for (const component of linked) {
      const slot = graph.slots.find((s) => s.id === component.slotId)
      if (!slot) continue
      const reuse = checkReusePolicy(event.recipeSnapshot.reusePolicy, nextDate, slot.date)
      if (reuse !== 'ok') return { ok: false, error: reuse }
    }

    if (patch.outputQuantity !== undefined) {
      const allocs = linked.map((c) => c.allocatedQuantity)
      const remaining = this.remainingForEvent({ ...event, outputQuantity: nextOutput }, allocs)
      if (remaining === null) return { ok: false, error: 'incompatible-quantity' }
      if (remaining.value < -1e-9) return { ok: false, error: 'over-allocated' }
    }

    await this.plans.updateCookingEvent(event.planId, eventId, {
      outputQuantity: patch.outputQuantity,
      scheduledDate: patch.scheduledDate,
    })
    return { ok: true }
  }

  async listCookingEventDependents(
    eventId: CookingEventId,
  ): Promise<{ ok: true; dependents: CookingEventDependent[] } | { ok: false; error: PlanError }> {
    const event = await this.plans.getCookingEvent(eventId)
    if (!event) return { ok: false, error: 'cooking-event-not-found' }
    const dependents = await this.plans.listCookingEventDependents(eventId)
    return { ok: true, dependents }
  }

  async listEligibleCookingEventsForSlot(
    slotId: MealSlotId,
    recipeId: RecipeId,
  ): Promise<{ ok: true; events: CookingEvent[] } | { ok: false; error: PlanError }> {
    const ctx = await this.slotPlanContext(slotId)
    if (!ctx.ok) return ctx

    const graph = await this.plans.getGraph(ctx.plan.id)
    if (!graph) return { ok: false, error: 'not-found' }

    const remainingByEventId = new Map<CookingEventId, Quantity | null>()
    for (const event of graph.cookingEvents) {
      const allocs = componentsForCookingEvent(graph.components, event.id).map(
        (c) => c.allocatedQuantity,
      )
      remainingByEventId.set(event.id, this.remainingForEvent(event, allocs))
    }

    const events = listEligibleCookingEvents(
      graph.cookingEvents,
      recipeId,
      ctx.slot.date,
      remainingByEventId,
    )
    return { ok: true, events }
  }

  remainingForCookingEvent(graph: PlanGraph, eventId: CookingEventId): Quantity | null {
    const event = graph.cookingEvents.find((e) => e.id === eventId)
    if (!event) return null
    const allocs = componentsForCookingEvent(graph.components, eventId).map(
      (c) => c.allocatedQuantity,
    )
    return this.remainingForEvent(event, allocs)
  }

  async clearSlot(slotId: MealSlotId): Promise<{ ok: true } | { ok: false; error: PlanError }> {
    const slot = await this.plans.getSlot(slotId)
    if (!slot) return { ok: false, error: 'slot-not-found' }
    await this.plans.clearSlot(slot.planId, slotId)
    return { ok: true }
  }

  /** Shared cooking events referenced by this slot that also feed other slots. */
  async listSharedDependentsForSlot(slotId: MealSlotId): Promise<
    | {
        ok: true
        shared: Array<{
          eventId: CookingEventId
          name: string
          dependents: CookingEventDependent[]
        }>
      }
    | { ok: false; error: PlanError }
  > {
    const slot = await this.plans.getSlot(slotId)
    if (!slot) return { ok: false, error: 'slot-not-found' }

    const components = await this.plans.listComponentsForSlot(slotId)
    const shared: Array<{
      eventId: CookingEventId
      name: string
      dependents: CookingEventDependent[]
    }> = []

    const seen = new Set<string>()
    for (const component of components) {
      if (component.source.type !== 'cooking-event') continue
      const eventId = component.source.cookingEventId
      if (seen.has(eventId)) continue
      seen.add(eventId)

      const dependents = await this.plans.listCookingEventDependents(eventId)
      const others = dependents.filter((d) => d.slotId !== slotId)
      if (others.length === 0) continue

      const event = await this.plans.getCookingEvent(eventId)
      shared.push({
        eventId,
        name: event?.recipeSnapshot.name ?? 'Preparation',
        dependents,
      })
    }

    return { ok: true, shared }
  }

  /** Neighbor week start date for prev/next navigation. */
  adjacentWeekStart(startDate: LocalDate, direction: -1 | 1): LocalDate {
    return addDays(startDate, direction * 7)
  }

  private async slotPlanContext(
    slotId: MealSlotId,
  ): Promise<{ ok: true; slot: MealSlot; plan: Plan } | { ok: false; error: PlanError }> {
    const slot = await this.plans.getSlot(slotId)
    if (!slot) return { ok: false, error: 'slot-not-found' }
    const plan = await this.plans.getById(slot.planId)
    if (!plan) return { ok: false, error: 'not-found' }
    return { ok: true, slot, plan }
  }

  private async buildCookingEventComponentInput(
    slotId: MealSlotId,
    recipeId: RecipeId,
    options: AddNewCookingEventOptions,
  ): Promise<
    | { ok: true; planId: PlanId; input: AddCookingEventComponentInput }
    | { ok: false; error: PlanError }
  > {
    const ctx = await this.slotPlanContext(slotId)
    if (!ctx.ok) return ctx

    const recipe = await this.recipes.getById(recipeId)
    if (!recipe) return { ok: false, error: 'recipe-not-found' }

    const defaultQty = this.quantities.scale(recipe.defaultPortionPerPerson, ctx.plan.peopleCount)
    if (!defaultQty || !Number.isFinite(defaultQty.value) || defaultQty.value <= 0) {
      return { ok: false, error: 'invalid-quantity' }
    }

    const outputQuantity = options.outputQuantity ?? defaultQty
    const allocatedQuantity = options.allocatedQuantity ?? defaultQty
    const scheduledDate = options.scheduledDate ?? ctx.slot.date
    const role = options.role ?? recipe.roles[0]

    if (
      !this.isValidPositiveQuantity(outputQuantity) ||
      !this.isValidPositiveQuantity(allocatedQuantity)
    ) {
      return { ok: false, error: 'invalid-quantity' }
    }

    const reuse = checkReusePolicy(recipe.reusePolicy, scheduledDate, ctx.slot.date)
    if (reuse !== 'ok') return { ok: false, error: reuse }

    if (outputQuantity.unit !== allocatedQuantity.unit) {
      if (!this.quantities.canConvert(outputQuantity, allocatedQuantity)) {
        return { ok: false, error: 'incompatible-quantity' }
      }
    }

    const cmp = this.quantities.compare(allocatedQuantity, outputQuantity)
    if (cmp === null) return { ok: false, error: 'incompatible-quantity' }
    if (cmp > 0) return { ok: false, error: 'over-allocated' }

    const tagRows = await this.tags.getByIds(recipe.tagIds)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { tagIds, ...recipeRest } = recipe
    const recipeSnapshot: RecipeSnapshot = {
      ...recipeRest,
      tags: tagRows.map((tag) => tag.name),
    }

    return {
      ok: true,
      planId: ctx.plan.id,
      input: {
        slotId,
        recipeId: recipe.id,
        recipeSnapshot,
        outputQuantity,
        allocatedQuantity,
        role,
        scheduledDate,
      },
    }
  }

  private isValidPositiveQuantity(q: Quantity): boolean {
    return Number.isFinite(q.value) && q.value > 0 && q.unit.length > 0
  }

  private checkAllocation(
    event: CookingEvent,
    components: readonly MealComponent[],
    additional: Quantity,
    excludeComponentId?: string,
  ): 'ok' | 'over-allocated' | 'incompatible-quantity' {
    // Prefer convert-aware path when units differ.
    if (additional.unit !== event.outputQuantity.unit) {
      if (!this.quantities.canConvert(event.outputQuantity, additional)) {
        return 'incompatible-quantity'
      }
    }

    const linked = componentsForCookingEvent(components, event.id, excludeComponentId)
    let used: Quantity | null = { value: 0, unit: event.outputQuantity.unit }
    for (const c of linked) {
      used = this.quantities.add(used, c.allocatedQuantity)
      if (!used) return 'incompatible-quantity'
    }
    const remaining = this.quantities.subtract(event.outputQuantity, used)
    if (!remaining) return 'incompatible-quantity'
    const cmp = this.quantities.compare(additional, remaining)
    if (cmp === null) return 'incompatible-quantity'
    if (cmp > 0) return 'over-allocated'
    return 'ok'
  }

  private remainingForEvent(event: CookingEvent, allocations: Quantity[]): Quantity | null {
    if (allocations.length === 0) return { ...event.outputQuantity }
    const sameUnit = remainingSameUnit(event.outputQuantity, allocations)
    if (sameUnit) return sameUnit

    let used: Quantity | null = { value: 0, unit: event.outputQuantity.unit }
    for (const q of allocations) {
      used = this.quantities.add(used, q)
      if (!used) return null
    }
    return this.quantities.subtract(event.outputQuantity, used)
  }
}
