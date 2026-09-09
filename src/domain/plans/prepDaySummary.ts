import type { PlanGraph } from './PlanGraph'
import type { LocalDate } from '../shared/LocalDate'
import { effortUnits, formatEffortUnits } from './prepEffort'

export function cookingEventsOnDate(graph: PlanGraph, date: LocalDate) {
  return graph.cookingEvents.filter((event) => event.scheduledDate === date)
}

export function effortUnitsForDate(graph: PlanGraph, date: LocalDate): number {
  return effortUnits(cookingEventsOnDate(graph, date).length)
}

export function formatPrepLabel(units: number): string | null {
  if (units <= 0) return null
  return `Prep · ${formatEffortUnits(units)}`
}
