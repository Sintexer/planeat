import type {
  AddCookingEventComponentInput,
  AddSimpleFoodComponentInput,
  CookingEventDependent,
  LinkCookingEventComponentInput,
  PlanRepository,
} from '../../../application/ports/PlanRepository'
import type { CookingEvent, CookingEventId } from '../../../domain/plans/CookingEvent'
import type { MealComponent, MealComponentId } from '../../../domain/plans/MealComponent'
import type { MealSlot, MealSlotId } from '../../../domain/plans/MealSlot'
import type { Plan, PlanId } from '../../../domain/plans/Plan'
import type { PlanGraph } from '../../../domain/plans/PlanGraph'
import type { LocalDate } from '../../../domain/shared/LocalDate'
import type { Quantity } from '../../../domain/shared/Quantity'
import type { AppDatabase } from '../database'

export class DexiePlanRepository implements PlanRepository {
  private readonly db: AppDatabase

  constructor(db: AppDatabase) {
    this.db = db
  }

  getById(id: PlanId): Promise<Plan | undefined> {
    return this.db.plans.get(id)
  }

  async getByStartDate(startDate: LocalDate): Promise<Plan | undefined> {
    return this.db.plans.where('startDate').equals(startDate).first()
  }

  async getGraph(id: PlanId): Promise<PlanGraph | undefined> {
    const plan = await this.db.plans.get(id)
    if (!plan) return undefined

    const slots = await this.db.mealSlots.where('planId').equals(id).toArray()
    const slotIds = slots.map((s) => s.id)
    const components =
      slotIds.length === 0
        ? []
        : await this.db.mealComponents.where('slotId').anyOf(slotIds).toArray()
    const cookingEvents = await this.db.cookingEvents.where('planId').equals(id).toArray()

    return { plan, slots, components, cookingEvents }
  }

  async createPlanWithSlots(plan: Plan, slots: MealSlot[]): Promise<void> {
    await this.db.transaction('rw', this.db.plans, this.db.mealSlots, async () => {
      await this.db.plans.add(plan)
      await this.db.mealSlots.bulkAdd(slots)
    })
  }

  getSlot(slotId: MealSlotId): Promise<MealSlot | undefined> {
    return this.db.mealSlots.get(slotId)
  }

  getComponent(componentId: MealComponentId): Promise<MealComponent | undefined> {
    return this.db.mealComponents.get(componentId)
  }

  async setSlotExcluded(slotId: MealSlotId, excluded: boolean): Promise<void> {
    await this.db.mealSlots.update(slotId, { excluded })
  }

  listComponentsForSlot(slotId: MealSlotId): Promise<MealComponent[]> {
    return this.db.mealComponents.where('slotId').equals(slotId).toArray()
  }

  getCookingEvent(id: CookingEventId): Promise<CookingEvent | undefined> {
    return this.db.cookingEvents.get(id)
  }

  async addCookingEventComponent(
    planId: PlanId,
    input: AddCookingEventComponentInput,
  ): Promise<MealComponent> {
    return this.db.transaction(
      'rw',
      this.db.plans,
      this.db.mealSlots,
      this.db.mealComponents,
      this.db.cookingEvents,
      async () => {
        await this.db.mealSlots.update(input.slotId, { excluded: false })

        const cookingEvent: CookingEvent = {
          id: crypto.randomUUID(),
          planId,
          sessionId: null,
          recipeId: input.recipeId,
          recipeSnapshot: structuredClone(input.recipeSnapshot),
          outputQuantity: input.outputQuantity,
          scheduledDate: input.scheduledDate,
        }
        await this.db.cookingEvents.add(cookingEvent)

        const component: MealComponent = {
          id: crypto.randomUUID(),
          slotId: input.slotId,
          source: { type: 'cooking-event', cookingEventId: cookingEvent.id },
          allocatedQuantity: input.allocatedQuantity,
          role: input.role,
        }
        await this.db.mealComponents.add(component)
        await this.bumpRevisionInTx(planId)
        return component
      },
    )
  }

  async linkCookingEventComponent(
    planId: PlanId,
    input: LinkCookingEventComponentInput,
  ): Promise<MealComponent> {
    return this.db.transaction(
      'rw',
      this.db.plans,
      this.db.mealSlots,
      this.db.mealComponents,
      this.db.cookingEvents,
      async () => {
        await this.db.mealSlots.update(input.slotId, { excluded: false })

        const component: MealComponent = {
          id: crypto.randomUUID(),
          slotId: input.slotId,
          source: { type: 'cooking-event', cookingEventId: input.cookingEventId },
          allocatedQuantity: input.allocatedQuantity,
          role: input.role,
        }
        await this.db.mealComponents.add(component)
        await this.bumpRevisionInTx(planId)
        return component
      },
    )
  }

  async addSimpleFoodComponent(
    planId: PlanId,
    input: AddSimpleFoodComponentInput,
  ): Promise<MealComponent> {
    return this.db.transaction(
      'rw',
      this.db.plans,
      this.db.mealSlots,
      this.db.mealComponents,
      async () => {
        await this.db.mealSlots.update(input.slotId, { excluded: false })

        const component: MealComponent = {
          id: crypto.randomUUID(),
          slotId: input.slotId,
          source: { type: 'simple-food', simpleFoodId: input.simpleFoodId },
          allocatedQuantity: input.allocatedQuantity,
          role: input.role,
        }
        await this.db.mealComponents.add(component)
        await this.bumpRevisionInTx(planId)
        return component
      },
    )
  }

  async updateComponentAllocation(
    planId: PlanId,
    componentId: MealComponentId,
    allocatedQuantity: Quantity,
  ): Promise<void> {
    await this.db.transaction('rw', this.db.plans, this.db.mealComponents, async () => {
      await this.db.mealComponents.update(componentId, { allocatedQuantity })
      await this.bumpRevisionInTx(planId)
    })
  }

  async removeComponent(planId: PlanId, componentId: MealComponentId): Promise<void> {
    await this.db.transaction(
      'rw',
      this.db.plans,
      this.db.mealComponents,
      this.db.cookingEvents,
      async () => {
        const component = await this.db.mealComponents.get(componentId)
        if (!component) return

        let eventId: CookingEventId | undefined
        if (component.source.type === 'cooking-event') {
          eventId = component.source.cookingEventId
        }

        await this.db.mealComponents.delete(componentId)

        if (eventId) {
          await this.deleteCookingEventIfOrphaned(eventId)
        }
        await this.bumpRevisionInTx(planId)
      },
    )
  }

  async updateCookingEvent(
    planId: PlanId,
    eventId: CookingEventId,
    patch: { outputQuantity?: Quantity; scheduledDate?: LocalDate },
  ): Promise<void> {
    await this.db.transaction('rw', this.db.plans, this.db.cookingEvents, async () => {
      const updates: Partial<CookingEvent> = {}
      if (patch.outputQuantity !== undefined) updates.outputQuantity = patch.outputQuantity
      if (patch.scheduledDate !== undefined) updates.scheduledDate = patch.scheduledDate
      if (Object.keys(updates).length === 0) return
      await this.db.cookingEvents.update(eventId, updates)
      await this.bumpRevisionInTx(planId)
    })
  }

  async listCookingEventDependents(eventId: CookingEventId): Promise<CookingEventDependent[]> {
    const components = await this.db.mealComponents
      .filter((c) => c.source.type === 'cooking-event' && c.source.cookingEventId === eventId)
      .toArray()

    const result: CookingEventDependent[] = []
    for (const component of components) {
      const slot = await this.db.mealSlots.get(component.slotId)
      if (!slot) continue
      result.push({
        componentId: component.id,
        slotId: slot.id,
        date: slot.date,
        mealType: slot.mealType,
      })
    }
    return result
  }

  async clearSlot(planId: PlanId, slotId: MealSlotId): Promise<void> {
    await this.db.transaction(
      'rw',
      this.db.plans,
      this.db.mealComponents,
      this.db.cookingEvents,
      async () => {
        await this.clearSlotContents(slotId)
        await this.bumpRevisionInTx(planId)
      },
    )
  }

  async bumpRevision(planId: PlanId): Promise<void> {
    await this.db.transaction('rw', this.db.plans, async () => {
      await this.bumpRevisionInTx(planId)
    })
  }

  private async bumpRevisionInTx(planId: PlanId): Promise<void> {
    const plan = await this.db.plans.get(planId)
    if (!plan) return
    await this.db.plans.update(planId, {
      revision: plan.revision + 1,
      updatedAt: Date.now(),
    })
  }

  private async deleteCookingEventIfOrphaned(eventId: CookingEventId): Promise<void> {
    const stillUsed = await this.db.mealComponents
      .filter((c) => c.source.type === 'cooking-event' && c.source.cookingEventId === eventId)
      .first()
    if (!stillUsed) {
      await this.db.cookingEvents.delete(eventId)
    }
  }

  /**
   * Removes components for the slot and deletes cooking events that are no longer
   * referenced by any remaining component in the database.
   */
  private async clearSlotContents(slotId: MealSlotId): Promise<void> {
    const components = await this.db.mealComponents.where('slotId').equals(slotId).toArray()
    const eventIds = components
      .filter((c) => c.source.type === 'cooking-event')
      .map((c) => (c.source.type === 'cooking-event' ? c.source.cookingEventId : ''))

    await this.db.mealComponents.where('slotId').equals(slotId).delete()

    for (const eventId of eventIds) {
      await this.deleteCookingEventIfOrphaned(eventId)
    }
  }
}
