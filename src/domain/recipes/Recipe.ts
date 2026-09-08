import type { IngredientId } from '../ingredients/Ingredient'
import type { Effort, MealType, RecipeRole, ReusePolicy } from '../shared/MealEnums'
import type { Quantity } from '../shared/Quantity'

export type RecipeId = string

export interface RecipeIngredientLine {
  ingredientId: IngredientId
  quantity: Quantity | null
  note?: string
  displayText: string
}

export interface Recipe {
  id: RecipeId
  name: string
  yield: Quantity
  defaultPortionPerPerson: Quantity
  ingredientLines: RecipeIngredientLine[]
  instructions: string
  roles: RecipeRole[]
  mealTypes: MealType[]
  effort: Effort
  activeTimeMinutes?: number
  totalTimeMinutes?: number
  reusePolicy: ReusePolicy
  freezerFriendly: boolean
  freezingNotes?: string
  tags: string[]
  sourceUrl?: string
  cuisine?: string
  maxPreferredRepeats?: number
  notes?: string
  createdAt: number
  updatedAt: number
}

/** Fields required when creating or fully replacing a recipe. */
export type RecipeWriteInput = Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>
