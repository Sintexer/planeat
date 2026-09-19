import type { CookingEvent } from '../CookingEvent'
import type { MealSlot, MealSlotId } from '../MealSlot'
import { isGenerationLocked } from '../MealSlot'
import type { PlanGraph } from '../PlanGraph'

/** Extra leftover slots that must join a replace request when a producer is selected. */
export function extraProducerDependentSlots(
  graph: PlanGraph,
  requestedSlotIds: readonly MealSlotId[],
): MealSlot[] {
  const requested = new Set(requestedSlotIds)
  const extra = new Map<MealSlotId, MealSlot>()
  const slotsById = new Map(graph.slots.map((slot) => [slot.id, slot]))

  for (const event of graph.cookingEvents) {
    if (!producerSlotRequested(graph, event, requested, slotsById)) continue
    for (const component of graph.components) {
      if (component.source.type !== 'cooking-event') continue
      if (component.source.cookingEventId !== event.id) continue
      if (requested.has(component.slotId)) continue
      const slot = slotsById.get(component.slotId)
      if (slot) extra.set(slot.id, slot)
    }
  }

  return [...extra.values()].sort((a, b) =>
    a.date === b.date ? a.mealType.localeCompare(b.mealType) : a.date.localeCompare(b.date),
  )
}

export function lockedDependentSlots(slots: readonly MealSlot[]): MealSlot[] {
  return slots.filter((slot) => isGenerationLocked(slot))
}

export function producerSlotRequested(
  graph: PlanGraph,
  event: CookingEvent,
  requested: ReadonlySet<MealSlotId>,
  slotsById: ReadonlyMap<MealSlotId, MealSlot> = new Map(
    graph.slots.map((slot) => [slot.id, slot]),
  ),
): boolean {
  return graph.components.some((component) => {
    if (component.source.type !== 'cooking-event') return false
    if (component.source.cookingEventId !== event.id) return false
    if (!requested.has(component.slotId)) return false
    const slot = slotsById.get(component.slotId)
    return slot?.date === event.scheduledDate
  })
}
