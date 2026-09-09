import type { LocalDate } from '../shared/LocalDate'
import type { PlanId } from './Plan'

export type PrepSessionId = string

export interface PrepSession {
  id: PrepSessionId
  planId: PlanId
  date: LocalDate
  time?: string | null
  label?: string | null
}
