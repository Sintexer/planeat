export type RecipeId = string

export interface Recipe {
  id: RecipeId
  name: string
  servings: number
  createdAt: number
  updatedAt: number
}
