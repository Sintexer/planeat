import type { IngredientId } from '../ingredients/Ingredient'
import type { MealType, RecipeRole } from '../shared/MealEnums'
import type { Quantity } from '../shared/Quantity'
import type { TagId } from '../tags/Tag'

export type SimpleFoodId = string

export interface SimpleFood {
  id: SimpleFoodId
  ingredientId: IngredientId
  name: string
  defaultPortion: Quantity
  roles: RecipeRole[]
  mealTypes: MealType[]
  tagIds: TagId[]
  enabledInSuggestions: boolean
  createdAt: number
  updatedAt: number
}
