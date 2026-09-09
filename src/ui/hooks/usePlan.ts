import { useLiveQuery } from 'dexie-react-hooks'
import type { PlanId } from '../../domain/plans/Plan'
import type { PlanGraph } from '../../domain/plans/PlanGraph'
import { db } from '../../infrastructure/db/database'

export function usePlan(planId: PlanId | undefined): PlanGraph | undefined {
  return useLiveQuery(async () => {
    if (!planId) return undefined
    const plan = await db.plans.get(planId)
    if (!plan) return undefined
    const slots = await db.mealSlots.where('planId').equals(planId).toArray()
    const slotIds = slots.map((s) => s.id)
    const components =
      slotIds.length === 0 ? [] : await db.mealComponents.where('slotId').anyOf(slotIds).toArray()
    const cookingEvents = await db.cookingEvents.where('planId').equals(planId).toArray()
    const prepSessions = await db.prepSessions.where('planId').equals(planId).toArray()
    return { plan, slots, components, cookingEvents, prepSessions }
  }, [planId])
}
