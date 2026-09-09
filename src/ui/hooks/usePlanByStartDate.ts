import { useLiveQuery } from 'dexie-react-hooks'
import type { PlanGraph } from '../../domain/plans/PlanGraph'
import type { LocalDate } from '../../domain/shared/LocalDate'
import { db } from '../../infrastructure/db/database'

/**
 * Live plan graph for a week start date.
 * Returns `undefined` while loading, `null` when no plan exists yet.
 */
export function usePlanByStartDate(startDate: LocalDate | undefined): PlanGraph | null | undefined {
  return useLiveQuery(async () => {
    if (!startDate) return undefined
    const plan = await db.plans.where('startDate').equals(startDate).first()
    if (!plan) return null
    const slots = await db.mealSlots.where('planId').equals(plan.id).toArray()
    const slotIds = slots.map((s) => s.id)
    const components =
      slotIds.length === 0 ? [] : await db.mealComponents.where('slotId').anyOf(slotIds).toArray()
    const cookingEvents = await db.cookingEvents.where('planId').equals(plan.id).toArray()
    return { plan, slots, components, cookingEvents }
  }, [startDate])
}
