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
}
