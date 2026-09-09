import type { LocalDate } from '../shared/LocalDate'

export type PlanId = string

/** Forward-compatible bag; Sprint 3 leaves this empty. */
export type PlanPreferences = Record<string, never>

export interface Plan {
  id: PlanId
  startDate: LocalDate
  dayCount: 7
  peopleCount: number
  /** Bumped on meal edits; used later for grocery list sync. */
  revision: number
  preferences: PlanPreferences
  createdAt: number
  updatedAt: number
}
