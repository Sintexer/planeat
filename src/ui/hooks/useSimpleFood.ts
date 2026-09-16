import { useLiveQuery } from 'dexie-react-hooks'
import type { SimpleFood, SimpleFoodId } from '../../domain/simpleFoods/SimpleFood'
import { db } from '../../infrastructure/db/database'

export function useSimpleFood(id: SimpleFoodId | undefined): SimpleFood | undefined | null {
  return useLiveQuery(async () => {
    if (!id) return null
    const food = await db.simpleFoods.get(id)
    return food ?? null
  }, [id])
}
