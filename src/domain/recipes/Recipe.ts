import type { IngredientId } from '../ingredients/Ingredient'
import type { Effort, MealType, RecipeRole, ReusePolicy } from '../shared/MealEnums'
import type { Quantity } from '../shared/Quantity'
import type { TagId } from '../tags/Tag'

export type RecipeId = string

export interface RecipeIngredientLine {
  /** Absent when an imported line was saved without linking to the catalog. */
  ingredientId?: IngredientId
  quantity: Quantity | null
  /** Free-form non-numeric amount (e.g. "to taste"). Mutually exclusive with `quantity` by UI convention. */
  quantityText?: string
  note?: string
  displayText: string
  /** Original imported ingredient line, preserved when the source text was parsed. */
  sourceText?: string
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
  tagIds: TagId[]
  sourceUrl?: string
  photoUrl?: string
  cuisine?: string
  /** Free string, not the DISH_TYPES union — an unrecognized/legacy value must always round-trip. */
  dishType?: string
  maxPreferredRepeats?: number
  notes?: string
  createdAt: number
  updatedAt: number
}

/** Fields required when creating or fully replacing a recipe. */
export type RecipeWriteInput = Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>
