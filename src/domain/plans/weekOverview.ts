import type { PlanGraph } from './PlanGraph'
import type { LocalDate } from '../shared/LocalDate'

/** A day has a plan if anything is cooked, eaten in, or marked eating-out. */
export function isDayPlanned(graph: PlanGraph, date: LocalDate): boolean {
  if (graph.cookingEvents.some((event) => event.scheduledDate === date)) return true
  const slots = graph.slots.filter((slot) => slot.date === date)
  if (slots.some((slot) => slot.excluded)) return true
  const slotIds = new Set(slots.map((slot) => slot.id))
  return graph.components.some((component) => slotIds.has(component.slotId))
}
