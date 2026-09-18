import type { IngredientId } from '../ingredients/Ingredient'
import type { Quantity } from '../shared/Quantity'
import type { GroceryListId } from './GroceryList'

export type GroceryItemId = string
export type GroceryItemOrigin = 'generated' | 'manual'

export interface GroceryItem {
  id: GroceryItemId
  listId: GroceryListId
  label: string
  ingredientId?: IngredientId
  quantity: Quantity | null
  checked: boolean
  origin: GroceryItemOrigin
  quantityManuallyEdited: boolean
  /** Optional shopping-section key copied at generate time, or set on a manual line. */
  shoppingSection?: string
  /** Plan contributions captured when the line was generated. Absent on manual lines and older lists. */
  sources?: GroceryItemSource[]
}

export type GroceryItemSourceKind = 'cooking-event' | 'simple-food'

export interface GroceryItemSourceMeal {
  slotId: string
  date: string
  mealType: string
}

export interface GroceryItemSource {
  kind: GroceryItemSourceKind
  dishName: string
  quantity: Quantity | null
  meals: GroceryItemSourceMeal[]
}
