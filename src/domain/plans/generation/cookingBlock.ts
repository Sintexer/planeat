import type { Recipe } from '../../recipes/Recipe'
import type { LocalDate } from '../../shared/LocalDate'
import type { Quantity } from '../../shared/Quantity'
import type { MealType } from '../../shared/MealEnums'
import type { MealSlotId } from '../MealSlot'
import type { KnownCompanion } from './compositions'
import type { CookingBlockPreview } from './proposal'

export type BlockConsumption = {
  slotId: MealSlotId
  date: LocalDate
  mealType: MealType
  allocated: Quantity
  companion?: KnownCompanion
}

export type CookingBlock = {
  id: string
  kind: 'main' | 'breakfast' | 'leftover'
  recipe: Recipe
  prepareSlotId: MealSlotId
  prepareDate: LocalDate
  production: Quantity
  consumptions: BlockConsumption[]
  leftoverEventId?: string
  proposed?: boolean
}

export function cookingBlockPreview(block: CookingBlock): CookingBlockPreview {
  return {
    id: block.id,
    kind: block.kind,
    recipeName: block.recipe.name,
    prepareDate: block.prepareDate,
    prepareSlotId: block.prepareSlotId,
    mealCount: block.consumptions.length,
    consumerSlotIds: block.consumptions.map((row) => row.slotId),
  }
}
