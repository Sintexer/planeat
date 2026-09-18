import type {
  CreateGroceryItemInput,
  CreateGroceryListInput,
  GroceryListWithItems,
  GroceryRepository,
  UpdateGroceryItemInput,
} from '../../../application/ports/GroceryRepository'
import type { GroceryItem, GroceryItemId } from '../../../domain/groceries/GroceryItem'
import type { GroceryList, GroceryListId } from '../../../domain/groceries/GroceryList'
import type { PlanId } from '../../../domain/plans/Plan'
import type { AppDatabase } from '../database'

export class DexieGroceryRepository implements GroceryRepository {
  private readonly db: AppDatabase

  constructor(db: AppDatabase) {
    this.db = db
  }

  async createList(input: CreateGroceryListInput): Promise<GroceryList> {
    const now = Date.now()
    const list: GroceryList = {
      id: crypto.randomUUID(),
      title: input.title,
      status: 'open',
      sourcePlanId: input.sourcePlanId,
      sourcePlanRevision: input.sourcePlanRevision,
      createdAt: now,
      updatedAt: now,
    }
    await this.db.groceryLists.add(list)
    return list
  }

  getList(id: GroceryListId): Promise<GroceryList | undefined> {
    return this.db.groceryLists.get(id)
  }

  async getListWithItems(id: GroceryListId): Promise<GroceryListWithItems | undefined> {
    const list = await this.db.groceryLists.get(id)
    if (!list) return undefined
    const items = await this.db.groceryItems.where('listId').equals(id).toArray()
    return { list, items }
  }

  async listAll(): Promise<GroceryList[]> {
    const lists = await this.db.groceryLists.toArray()
    return lists.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async findOpenBySourcePlanId(planId: PlanId): Promise<GroceryList | undefined> {
    const matches = await this.db.groceryLists.where('sourcePlanId').equals(planId).toArray()
    return matches.find((list) => list.status === 'open')
  }

  async updateList(
    id: GroceryListId,
    changes: Partial<Pick<GroceryList, 'title' | 'status' | 'sourcePlanId' | 'sourcePlanRevision'>>,
  ): Promise<void> {
    await this.db.groceryLists.update(id, { ...changes, updatedAt: Date.now() })
  }

  async deleteList(id: GroceryListId): Promise<void> {
    await this.db.transaction('rw', this.db.groceryLists, this.db.groceryItems, async () => {
      await this.db.groceryItems.where('listId').equals(id).delete()
      await this.db.groceryLists.delete(id)
    })
  }

  async createItem(input: CreateGroceryItemInput): Promise<GroceryItem> {
    const item: GroceryItem = {
      id: crypto.randomUUID(),
      listId: input.listId,
      label: input.label,
      ingredientId: input.ingredientId,
      quantity: input.quantity,
      checked: input.checked ?? false,
      origin: input.origin,
      quantityManuallyEdited: input.quantityManuallyEdited ?? false,
      shoppingSection: input.shoppingSection,
      sources: input.sources,
    }
    await this.db.groceryItems.add(item)
    await this.db.groceryLists.update(input.listId, { updatedAt: Date.now() })
    return item
  }

  async createItems(inputs: CreateGroceryItemInput[]): Promise<GroceryItem[]> {
    if (inputs.length === 0) return []
    const items: GroceryItem[] = inputs.map((input) => ({
      id: crypto.randomUUID(),
      listId: input.listId,
      label: input.label,
      ingredientId: input.ingredientId,
      quantity: input.quantity,
      checked: input.checked ?? false,
      origin: input.origin,
      quantityManuallyEdited: input.quantityManuallyEdited ?? false,
      shoppingSection: input.shoppingSection,
      sources: input.sources,
    }))
    const listId = inputs[0]!.listId
    await this.db.transaction('rw', this.db.groceryItems, this.db.groceryLists, async () => {
      await this.db.groceryItems.bulkAdd(items)
      await this.db.groceryLists.update(listId, { updatedAt: Date.now() })
    })
    return items
  }

  getItem(id: GroceryItemId): Promise<GroceryItem | undefined> {
    return this.db.groceryItems.get(id)
  }

  getItemsForList(listId: GroceryListId): Promise<GroceryItem[]> {
    return this.db.groceryItems.where('listId').equals(listId).toArray()
  }

  async updateItem(id: GroceryItemId, changes: UpdateGroceryItemInput): Promise<void> {
    const existing = await this.db.groceryItems.get(id)
    if (!existing) return
    const next: GroceryItem = { ...existing, ...changes }
    if ('shoppingSection' in changes) {
      const trimmed = changes.shoppingSection?.trim()
      if (trimmed) next.shoppingSection = trimmed
      else delete next.shoppingSection
    }
    await this.db.transaction('rw', this.db.groceryItems, this.db.groceryLists, async () => {
      await this.db.groceryItems.put(next)
      await this.db.groceryLists.update(existing.listId, { updatedAt: Date.now() })
    })
  }

  async deleteItem(id: GroceryItemId): Promise<void> {
    const existing = await this.db.groceryItems.get(id)
    if (!existing) return
    await this.db.transaction('rw', this.db.groceryItems, this.db.groceryLists, async () => {
      await this.db.groceryItems.delete(id)
      await this.db.groceryLists.update(existing.listId, { updatedAt: Date.now() })
    })
  }

  async deleteGeneratedItems(listId: GroceryListId): Promise<void> {
    await this.db.transaction('rw', this.db.groceryItems, this.db.groceryLists, async () => {
      const items = await this.db.groceryItems.where('listId').equals(listId).toArray()
      const generatedIds = items
        .filter((item) => item.origin === 'generated')
        .map((item) => item.id)
      await this.db.groceryItems.bulkDelete(generatedIds)
      await this.db.groceryLists.update(listId, { updatedAt: Date.now() })
    })
  }
}
