import { BowlFood, MoonStars, SunHorizon, type Icon } from '@phosphor-icons/react'
import type { MealType } from '../../domain/shared/MealEnums'

export const MEAL_TYPE_ICONS: Record<MealType, Icon> = {
  breakfast: SunHorizon,
  lunch: BowlFood,
  dinner: MoonStars,
}
