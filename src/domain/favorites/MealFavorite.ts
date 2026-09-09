import type { RecipeId } from '../recipes/Recipe'
import type { RecipeRole } from '../shared/MealEnums'
import type { Quantity } from '../shared/Quantity'
import type { SimpleFoodId } from '../simpleFoods/SimpleFood'

export type MealFavoriteId = string

export type FavoriteComponent =
  | {
      type: 'recipe'
      recipeId: RecipeId
      allocatedQuantity: Quantity
      role?: RecipeRole
    }
  | {
      type: 'simple-food'
      simpleFoodId: SimpleFoodId
      allocatedQuantity: Quantity
      role?: RecipeRole
    }

export interface MealFavorite {
  id: MealFavoriteId
  name: string
  components: FavoriteComponent[]
  createdAt: number
  updatedAt: number
}
