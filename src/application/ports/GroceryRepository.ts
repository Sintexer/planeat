import type {
  GroceryItem,
  GroceryItemId,
  GroceryItemSource,
} from '../../domain/groceries/GroceryItem'
import type { GroceryList, GroceryListId } from '../../domain/groceries/GroceryList'
import type { Quantity } from '../../domain/shared/Quantity'
import type { PlanId } from '../../domain/plans/Plan'

export type CreateGroceryListInput = {
  title: string
  sourcePlanId?: PlanId
  sourcePlanRevision?: number
}

export type CreateGroceryItemInput = {
  listId: GroceryListId
  label: string
  ingredientId?: string
  quantity: Quantity | null
  checked?: boolean
  origin: 'generated' | 'manual'
  quantityManuallyEdited?: boolean
  shoppingSection?: string
  sources?: GroceryItemSource[]
}

export type UpdateGroceryItemInput = Partial<
  Pick<
    GroceryItem,
    'label' | 'quantity' | 'checked' | 'quantityManuallyEdited' | 'shoppingSection' | 'sources'
  >
>

export interface GroceryListWithItems {
  list: GroceryList
  items: GroceryItem[]
}

export interface GroceryRepository {
  createList(input: CreateGroceryListInput): Promise<GroceryList>
  getList(id: GroceryListId): Promise<GroceryList | undefined>
  getListWithItems(id: GroceryListId): Promise<GroceryListWithItems | undefined>
  listAll(): Promise<GroceryList[]>
  findOpenBySourcePlanId(planId: PlanId): Promise<GroceryList | undefined>
  updateList(
    id: GroceryListId,
    changes: Partial<Pick<GroceryList, 'title' | 'status' | 'sourcePlanId' | 'sourcePlanRevision'>>,
  ): Promise<void>
  deleteList(id: GroceryListId): Promise<void>

  createItem(input: CreateGroceryItemInput): Promise<GroceryItem>
  createItems(inputs: CreateGroceryItemInput[]): Promise<GroceryItem[]>
  getItem(id: GroceryItemId): Promise<GroceryItem | undefined>
  getItemsForList(listId: GroceryListId): Promise<GroceryItem[]>
  updateItem(id: GroceryItemId, changes: UpdateGroceryItemInput): Promise<void>
  deleteItem(id: GroceryItemId): Promise<void>
  deleteGeneratedItems(listId: GroceryListId): Promise<void>
}
