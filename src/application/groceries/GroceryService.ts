import type {
  CreateGroceryItemInput,
  GroceryListWithItems,
  GroceryRepository,
} from '../ports/GroceryRepository'
import type { IngredientRepository } from '../ports/IngredientRepository'
import type { PlanRepository } from '../ports/PlanRepository'
import type { SimpleFoodRepository } from '../ports/SimpleFoodRepository'
import type { QuantityService } from '../quantities/QuantityService'
import type { GroceryItem, GroceryItemId } from '../../domain/groceries/GroceryItem'
import type { GroceryList, GroceryListId } from '../../domain/groceries/GroceryList'
import type { PlanId } from '../../domain/plans/Plan'
import type { PlanGraph } from '../../domain/plans/PlanGraph'
import type { Quantity } from '../../domain/shared/Quantity'
import type { IngredientId } from '../../domain/ingredients/Ingredient'

export type GroceryError =
  'not-found' | 'list-closed' | 'plan-not-found' | 'empty-label' | 'item-not-found'

type RequirementLine = {
  ingredientId?: IngredientId
  label: string
  quantity: Quantity | null
}

export class GroceryService {
  private readonly groceries: GroceryRepository
  private readonly plans: PlanRepository
  private readonly ingredients: IngredientRepository
  private readonly simpleFoods: SimpleFoodRepository
  private readonly quantities: QuantityService

  constructor(
    groceries: GroceryRepository,
    plans: PlanRepository,
    ingredients: IngredientRepository,
    simpleFoods: SimpleFoodRepository,
    quantities: QuantityService,
  ) {
    this.groceries = groceries
    this.plans = plans
    this.ingredients = ingredients
    this.simpleFoods = simpleFoods
    this.quantities = quantities
  }

  listLists(): Promise<GroceryList[]> {
    return this.groceries.listAll()
  }

  getList(id: GroceryListId): Promise<GroceryListWithItems | undefined> {
    return this.groceries.getListWithItems(id)
  }

  findOpenListForPlan(planId: PlanId): Promise<GroceryList | undefined> {
    return this.groceries.findOpenBySourcePlanId(planId)
  }

  async createEmptyList(
    title: string,
  ): Promise<{ ok: true; list: GroceryList } | { ok: false; error: GroceryError }> {
    const trimmed = title.trim()
    if (!trimmed) return { ok: false, error: 'empty-label' }
    const list = await this.groceries.createList({ title: trimmed })
    return { ok: true, list }
  }

  async generateFromPlan(
    planId: PlanId,
  ): Promise<{ ok: true; list: GroceryList } | { ok: false; error: GroceryError }> {
    const graph = await this.plans.getGraph(planId)
    if (!graph) return { ok: false, error: 'plan-not-found' }

    const lines = await this.buildRequirementLines(graph)
    const list = await this.groceries.createList({
      title: `Week of ${graph.plan.startDate}`,
      sourcePlanId: graph.plan.id,
      sourcePlanRevision: graph.plan.revision,
    })
    await this.persistGeneratedItems(list.id, lines, new Map())
    return { ok: true, list }
  }

  /**
   * Pragmatic MVP update: replace generated lines; preserve checked for matching
   * ingredientId; keep all manual items. Open lists only.
   */
  async updateFromPlan(
    listId: GroceryListId,
  ): Promise<{ ok: true; list: GroceryList } | { ok: false; error: GroceryError }> {
    const existing = await this.groceries.getListWithItems(listId)
    if (!existing) return { ok: false, error: 'not-found' }
    if (existing.list.status === 'closed') return { ok: false, error: 'list-closed' }
    if (!existing.list.sourcePlanId) return { ok: false, error: 'plan-not-found' }

    const graph = await this.plans.getGraph(existing.list.sourcePlanId)
    if (!graph) return { ok: false, error: 'plan-not-found' }

    const priorChecked = new Map<string, boolean>()
    for (const item of existing.items) {
      if (item.origin === 'generated' && item.ingredientId) {
        priorChecked.set(item.ingredientId, item.checked)
      }
    }

    const lines = await this.buildRequirementLines(graph)
    await this.groceries.deleteGeneratedItems(listId)
    await this.persistGeneratedItems(listId, lines, priorChecked)
    await this.groceries.updateList(listId, {
      sourcePlanRevision: graph.plan.revision,
      title: existing.list.title.startsWith('Week of ')
        ? `Week of ${graph.plan.startDate}`
        : existing.list.title,
    })

    const updated = await this.groceries.getList(listId)
    if (!updated) return { ok: false, error: 'not-found' }
    return { ok: true, list: updated }
  }

  async addManualItem(
    listId: GroceryListId,
    label: string,
    quantity: Quantity | null = null,
  ): Promise<{ ok: true; item: GroceryItem } | { ok: false; error: GroceryError }> {
    const list = await this.groceries.getList(listId)
    if (!list) return { ok: false, error: 'not-found' }
    if (list.status === 'closed') return { ok: false, error: 'list-closed' }
    const trimmed = label.trim()
    if (!trimmed) return { ok: false, error: 'empty-label' }

    const item = await this.groceries.createItem({
      listId,
      label: trimmed,
      quantity,
      checked: false,
      origin: 'manual',
      quantityManuallyEdited: quantity !== null,
    })
    return { ok: true, item }
  }

  async updateItem(
    itemId: GroceryItemId,
    changes: { label?: string; quantity?: Quantity | null; checked?: boolean },
  ): Promise<{ ok: true } | { ok: false; error: GroceryError }> {
    const items = await this.findItem(itemId)
    if (!items) return { ok: false, error: 'item-not-found' }
    const { item, list } = items
    if (list.status === 'closed') return { ok: false, error: 'list-closed' }

    const patch: {
      label?: string
      quantity?: Quantity | null
      checked?: boolean
      quantityManuallyEdited?: boolean
    } = {}

    if (changes.label !== undefined) {
      const trimmed = changes.label.trim()
      if (!trimmed) return { ok: false, error: 'empty-label' }
      patch.label = trimmed
    }
    if (changes.quantity !== undefined) {
      patch.quantity = changes.quantity
      patch.quantityManuallyEdited = true
    }
    if (changes.checked !== undefined) {
      patch.checked = changes.checked
    }

    await this.groceries.updateItem(item.id, patch)
    return { ok: true }
  }

  async toggleChecked(
    itemId: GroceryItemId,
  ): Promise<{ ok: true; checked: boolean } | { ok: false; error: GroceryError }> {
    const found = await this.findItem(itemId)
    if (!found) return { ok: false, error: 'item-not-found' }
    if (found.list.status === 'closed') return { ok: false, error: 'list-closed' }
    const checked = !found.item.checked
    await this.groceries.updateItem(itemId, { checked })
    return { ok: true, checked }
  }

  async deleteItem(
    itemId: GroceryItemId,
  ): Promise<{ ok: true } | { ok: false; error: GroceryError }> {
    const found = await this.findItem(itemId)
    if (!found) return { ok: false, error: 'item-not-found' }
    if (found.list.status === 'closed') return { ok: false, error: 'list-closed' }
    await this.groceries.deleteItem(itemId)
    return { ok: true }
  }

  async closeList(
    listId: GroceryListId,
  ): Promise<{ ok: true } | { ok: false; error: GroceryError }> {
    const list = await this.groceries.getList(listId)
    if (!list) return { ok: false, error: 'not-found' }
    await this.groceries.updateList(listId, { status: 'closed' })
    return { ok: true }
  }

  async reopenList(
    listId: GroceryListId,
  ): Promise<{ ok: true } | { ok: false; error: GroceryError }> {
    const list = await this.groceries.getList(listId)
    if (!list) return { ok: false, error: 'not-found' }
    await this.groceries.updateList(listId, { status: 'open' })
    return { ok: true }
  }

  async deleteList(
    listId: GroceryListId,
  ): Promise<{ ok: true } | { ok: false; error: GroceryError }> {
    const list = await this.groceries.getList(listId)
    if (!list) return { ok: false, error: 'not-found' }
    await this.groceries.deleteList(listId)
    return { ok: true }
  }

  private async findItem(
    itemId: GroceryItemId,
  ): Promise<{ item: GroceryItem; list: GroceryList } | undefined> {
    const item = await this.groceries.getItem(itemId)
    if (!item) return undefined
    const list = await this.groceries.getList(item.listId)
    if (!list) return undefined
    return { item, list }
  }

  private async buildRequirementLines(graph: PlanGraph): Promise<RequirementLine[]> {
    const excludedSlotIds = new Set(
      graph.slots.filter((slot) => slot.excluded).map((slot) => slot.id),
    )
    const activeComponents = graph.components.filter(
      (component) => !excludedSlotIds.has(component.slotId),
    )

    const cookingEventIds = new Set<string>()
    for (const component of activeComponents) {
      if (component.source.type === 'cooking-event') {
        cookingEventIds.add(component.source.cookingEventId)
      }
    }

    const lines: RequirementLine[] = []

    for (const event of graph.cookingEvents) {
      if (!cookingEventIds.has(event.id)) continue
      const snapshot = event.recipeSnapshot
      const yieldQty = snapshot.yield
      const output = event.outputQuantity
      const unitsMatch = yieldQty.unit === output.unit && yieldQty.value > 0
      const factor = unitsMatch ? output.value / yieldQty.value : null

      for (const recipeLine of snapshot.ingredientLines) {
        const ingredient = await this.ingredients.getById(recipeLine.ingredientId)
        const label = ingredient?.name ?? recipeLine.displayText
        if (factor === null) {
          lines.push({
            ingredientId: recipeLine.ingredientId,
            label,
            quantity: null,
          })
        } else {
          lines.push({
            ingredientId: recipeLine.ingredientId,
            label,
            quantity: this.quantities.scale(recipeLine.quantity, factor),
          })
        }
      }
    }

    for (const component of activeComponents) {
      if (component.source.type !== 'simple-food') continue
      const food = await this.simpleFoods.getById(component.source.simpleFoodId)
      if (!food) continue
      const ingredient = await this.ingredients.getById(food.ingredientId)
      lines.push({
        ingredientId: food.ingredientId,
        label: ingredient?.name ?? food.name,
        quantity: component.allocatedQuantity,
      })
    }

    return this.aggregateLines(lines)
  }

  private aggregateLines(lines: RequirementLine[]): RequirementLine[] {
    const withoutId: RequirementLine[] = []
    const byIngredient = new Map<string, RequirementLine[]>()

    for (const line of lines) {
      if (!line.ingredientId) {
        withoutId.push(line)
        continue
      }
      const group = byIngredient.get(line.ingredientId) ?? []
      group.push(line)
      byIngredient.set(line.ingredientId, group)
    }

    const aggregated: RequirementLine[] = [...withoutId]

    for (const [, group] of byIngredient) {
      const buckets: RequirementLine[] = []
      for (const line of group) {
        let merged = false
        for (const bucket of buckets) {
          if (line.quantity === null && bucket.quantity === null) {
            merged = true
            break
          }
          if (
            line.quantity !== null &&
            bucket.quantity !== null &&
            this.quantities.canConvert(bucket.quantity, line.quantity)
          ) {
            const sum = this.quantities.add(bucket.quantity, line.quantity)
            if (sum) {
              bucket.quantity = sum
              merged = true
              break
            }
          }
        }
        if (!merged) {
          buckets.push({ ...line })
        }
      }
      aggregated.push(...buckets)
    }

    return aggregated
  }

  private async persistGeneratedItems(
    listId: GroceryListId,
    lines: RequirementLine[],
    priorChecked: Map<string, boolean>,
  ): Promise<void> {
    const inputs: CreateGroceryItemInput[] = []
    for (const line of lines) {
      let checked = false
      if (line.ingredientId) {
        if (priorChecked.has(line.ingredientId)) {
          checked = priorChecked.get(line.ingredientId)!
        } else {
          const ingredient = await this.ingredients.getById(line.ingredientId)
          checked = ingredient?.isCommon ?? false
        }
      }
      inputs.push({
        listId,
        label: line.label,
        ingredientId: line.ingredientId,
        quantity: line.quantity,
        checked,
        origin: 'generated',
        quantityManuallyEdited: false,
      })
    }
    await this.groceries.createItems(inputs)
  }
}
