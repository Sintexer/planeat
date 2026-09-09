export type GroceryListId = string
export type GroceryListStatus = 'open' | 'closed'

export interface GroceryList {
  id: GroceryListId
  title: string
  status: GroceryListStatus
  sourcePlanId?: string
  sourcePlanRevision?: number
  createdAt: number
  updatedAt: number
}
