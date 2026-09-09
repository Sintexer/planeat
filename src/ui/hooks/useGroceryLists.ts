import { useLiveQuery } from 'dexie-react-hooks'
import type { GroceryList } from '../../domain/groceries/GroceryList'
import { db } from '../../infrastructure/db/database'

export function useGroceryLists(): GroceryList[] | undefined {
  return useLiveQuery(async () => {
    const lists = await db.groceryLists.toArray()
    return lists.sort((a, b) => b.updatedAt - a.updatedAt)
  }, [])
}
