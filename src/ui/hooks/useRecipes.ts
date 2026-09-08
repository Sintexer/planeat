import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../infrastructure/db/database'
import type { Recipe } from '../../domain/recipes/Recipe'

export function useRecipes(): Recipe[] | undefined {
  return useLiveQuery(() => db.recipes.orderBy('name').toArray(), [])
}
