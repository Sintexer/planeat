import { useLiveQuery } from 'dexie-react-hooks'
import type { MealFavorite } from '../../domain/favorites/MealFavorite'
import { db } from '../../infrastructure/db/database'

export function useMealFavorites(): MealFavorite[] | undefined {
  return useLiveQuery(() => db.mealFavorites.orderBy('name').toArray(), [])
}
