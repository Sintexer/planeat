import { useLiveQuery } from 'dexie-react-hooks'
import type { GroceryItem } from '../../domain/groceries/GroceryItem'
import type { GroceryList, GroceryListId } from '../../domain/groceries/GroceryList'
import { db } from '../../infrastructure/db/database'

export type GroceryListDetail = {
  list: GroceryList
  items: GroceryItem[]
}

/** `undefined` while loading; `null` when the list id is missing. */
export function useGroceryList(
  listId: GroceryListId | undefined,
): GroceryListDetail | null | undefined {
  return useLiveQuery(async () => {
    if (!listId) return null
    const list = await db.groceryLists.get(listId)
    if (!list) return null
    const items = await db.groceryItems.where('listId').equals(listId).toArray()
    return { list, items }
  }, [listId])
}
