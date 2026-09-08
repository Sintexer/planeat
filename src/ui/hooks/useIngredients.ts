import { useLiveQuery } from 'dexie-react-hooks'
import type { Ingredient } from '../../domain/ingredients/Ingredient'
import { db } from '../../infrastructure/db/database'

export function useIngredients(): Ingredient[] | undefined {
  return useLiveQuery(() => db.ingredients.orderBy('name').toArray(), [])
}
