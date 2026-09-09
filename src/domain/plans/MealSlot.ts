import type { MealType } from '../shared/MealEnums'
import type { LocalDate } from '../shared/LocalDate'
import type { PlanId } from './Plan'

export type MealSlotId = string

export interface MealSlot {
  id: MealSlotId
  planId: PlanId
  date: LocalDate
  mealType: MealType
  excluded: boolean
  note?: string
}
