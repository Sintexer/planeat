import type {
  CreateGroceryItemInput,
  GroceryListWithItems,
  GroceryRepository,
} from '../ports/GroceryRepository'
import type { IngredientRepository } from '../ports/IngredientRepository'
import type { PlanRepository } from '../ports/PlanRepository'
import type { RecipeRepository } from '../ports/RecipeRepository'
import type { SimpleFoodRepository } from '../ports/SimpleFoodRepository'
import type { QuantityService } from '../quantities/QuantityService'
import type {
  GroceryItem,
  GroceryItemId,
  GroceryItemSource,
} from '../../domain/groceries/GroceryItem'
import type { GroceryList, GroceryListId } from '../../domain/groceries/GroceryList'
import { normalizeShoppingSection } from '../../domain/groceries/shoppingSections'
import type { PlanId } from '../../domain/plans/Plan'
import type { PlanGraph } from '../../domain/plans/PlanGraph'
import type { Quantity } from '../../domain/shared/Quantity'
import type { IngredientId } from '../../domain/ingredients/Ingredient'

export type GroceryError =
  'not-found' | 'list-closed' | 'plan-not-found' | 'empty-label' | 'item-not-found'

export type GroceryQuantityChoice = 'keep' | 'use-plan'

export type GroceryUpdateChoices = {
  quantityChoices?: Record<string, GroceryQuantityChoice>
}

export type GroceryLinePreview = {
  key: string
  ingredientId?: string
  label: string
  quantity: Quantity | null
}

export type GroceryQuantityChange = {
  key: string
  label: string
  from: Quantity | null
  to: Quantity | null
  checked: boolean
}

export type GroceryOverridePreview = {
  key: string
  label: string
  current: Quantity | null
  planned: Quantity | null
  checked: boolean
}

export type GroceryUpdatePreview = {
  added: GroceryLinePreview[]
  removed: GroceryLinePreview[]
  changed: GroceryQuantityChange[]
  overrides: GroceryOverridePreview[]
  willUncheck: GroceryQuantityChange[]
  manualKeptCount: number
  unchangedCount: number
}

type RequirementLine = {
  ingredientId?: IngredientId
  label: string
  quantity: Quantity | null
  sources: GroceryItemSource[]
}

export class GroceryService {
  private readonly groceries: GroceryRepository
  private readonly plans: PlanRepository
  private readonly ingredients: IngredientRepository
  private readonly simpleFoods: SimpleFoodRepository
  private readonly quantities: QuantityService
  private readonly recipes: RecipeRepository

  constructor(
    groceries: GroceryRepository,
    plans: PlanRepository,
    ingredients: IngredientRepository,
    simpleFoods: SimpleFoodRepository,
    quantities: QuantityService,
    recipes: RecipeRepository,
  ) {
    this.groceries = groceries
    this.plans = plans
    this.ingredients = ingredients
    this.simpleFoods = simpleFoods
    this.quantities = quantities
    this.recipes = recipes
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

  async updateFromPlan(
    listId: GroceryListId,
    choices: GroceryUpdateChoices = {},
  ): Promise<{ ok: true; list: GroceryList } | { ok: false; error: GroceryError }> {
    const loaded = await this.loadOpenPlanList(listId)
    if (!loaded.ok) return loaded

    const { existing, graph } = loaded
    const nextLines = await this.buildRequirementLines(graph)
    const quantityChoices = choices.quantityChoices ?? {}
    const { added, removed, matched } = this.pairGeneratedLines(
      existing.items.filter((item) => item.origin === 'generated'),
      nextLines,
    )

    for (const item of removed) {
      await this.groceries.deleteItem(item.id)
    }

    for (const { previous, next } of matched) {
      const quantity = this.resultingQuantity(previous, next.quantity, quantityChoices)
      const keepOverride =
        previous.quantityManuallyEdited && (quantityChoices[previous.id] ?? 'keep') === 'keep'
      const checked = previous.checked && !this.isQuantityIncrease(previous.quantity, quantity)
      await this.groceries.updateItem(previous.id, {
        quantity,
        quantityManuallyEdited: keepOverride,
        checked,
        sources: next.sources.length > 0 ? next.sources : undefined,
      })
    }

    await this.persistGeneratedItems(listId, added, new Map())
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

  async previewUpdateFromPlan(
    listId: GroceryListId,
    choices: GroceryUpdateChoices = {},
  ): Promise<{ ok: true; preview: GroceryUpdatePreview } | { ok: false; error: GroceryError }> {
    const loaded = await this.loadOpenPlanList(listId)
    if (!loaded.ok) return loaded

    const { existing, graph } = loaded
    const nextLines = await this.buildRequirementLines(graph)
    const previousGenerated = existing.items.filter((item) => item.origin === 'generated')
    const { added, removed, matched } = this.pairGeneratedLines(previousGenerated, nextLines)
    const quantityChoices = choices.quantityChoices ?? {}

    const addedPreview: GroceryLinePreview[] = added.map((line, index) => ({
      key: `added:${identityKey(line)}:${index}`,
      ingredientId: line.ingredientId,
      label: line.label,
      quantity: line.quantity,
    }))
    const removedPreview: GroceryLinePreview[] = removed.map((item) => ({
      key: item.id,
      ingredientId: item.ingredientId,
      label: item.label,
      quantity: item.quantity,
    }))

    const changed: GroceryQuantityChange[] = []
    const overrides: GroceryOverridePreview[] = []
    const willUncheck: GroceryQuantityChange[] = []
    let unchangedCount = 0

    for (const { previous, next } of matched) {
      const planned = next.quantity
      const resulting = this.resultingQuantity(previous, planned, quantityChoices)
      const plannedDiffers = this.quantityDiffers(previous.quantity, planned)
      const isOverride = previous.quantityManuallyEdited && plannedDiffers
      if (isOverride) {
        overrides.push({
          key: previous.id,
          label: previous.label,
          current: previous.quantity,
          planned,
          checked: previous.checked,
        })
      } else if (this.quantityDiffers(previous.quantity, resulting)) {
        changed.push({
          key: previous.id,
          label: previous.label,
          from: previous.quantity,
          to: resulting,
          checked: previous.checked,
        })
      } else {
        unchangedCount += 1
      }
      if (previous.checked && this.isQuantityIncrease(previous.quantity, resulting)) {
        willUncheck.push({
          key: previous.id,
          label: previous.label,
          from: previous.quantity,
          to: resulting,
          checked: true,
        })
      }
    }

    return {
      ok: true,
      preview: {
        added: addedPreview,
        removed: removedPreview,
        changed,
        overrides,
        willUncheck,
        manualKeptCount: existing.items.filter((item) => item.origin === 'manual').length,
        unchangedCount,
      },
    }
  }

  async addManualItem(
    listId: GroceryListId,
    label: string,
    quantity: Quantity | null = null,
    shoppingSection?: string,
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
      shoppingSection: normalizeShoppingSection(shoppingSection),
    })
    return { ok: true, item }
  }

  async updateItem(
    itemId: GroceryItemId,
    changes: {
      label?: string
      quantity?: Quantity | null
      checked?: boolean
      shoppingSection?: string | null
    },
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
      shoppingSection?: string
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
    if (changes.shoppingSection !== undefined) {
      patch.shoppingSection = normalizeShoppingSection(changes.shoppingSection)
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

  private async loadOpenPlanList(
    listId: GroceryListId,
  ): Promise<
    | { ok: true; existing: GroceryListWithItems; graph: PlanGraph }
    | { ok: false; error: GroceryError }
  > {
    const existing = await this.groceries.getListWithItems(listId)
    if (!existing) return { ok: false, error: 'not-found' }
    if (existing.list.status === 'closed') return { ok: false, error: 'list-closed' }
    if (!existing.list.sourcePlanId) return { ok: false, error: 'plan-not-found' }
    const graph = await this.plans.getGraph(existing.list.sourcePlanId)
    if (!graph) return { ok: false, error: 'plan-not-found' }
    return { ok: true, existing, graph }
  }

  private pairGeneratedLines(
    previous: GroceryItem[],
    nextLines: RequirementLine[],
  ): {
    added: RequirementLine[]
    removed: GroceryItem[]
    matched: { previous: GroceryItem; next: RequirementLine }[]
  } {
    const previousByIdentity = groupBy(previous, identityKey)
    const nextByIdentity = groupBy(nextLines, identityKey)
    const identities = new Set([...previousByIdentity.keys(), ...nextByIdentity.keys()])
    const added: RequirementLine[] = []
    const removed: GroceryItem[] = []
    const matched: { previous: GroceryItem; next: RequirementLine }[] = []

    for (const identity of identities) {
      const prevGroup = [...(previousByIdentity.get(identity) ?? [])]
      const nextGroup = [...(nextByIdentity.get(identity) ?? [])]
      const usedNext = new Set<number>()
      const unmatchedPrev: GroceryItem[] = []

      for (const item of prevGroup) {
        const idx = nextGroup.findIndex(
          (line, index) =>
            !usedNext.has(index) && this.sameQuantityBucket(item.quantity, line.quantity),
        )
        if (idx === -1) {
          unmatchedPrev.push(item)
          continue
        }
        usedNext.add(idx)
        matched.push({ previous: item, next: nextGroup[idx]! })
      }

      const leftoverNext = nextGroup.filter((_, index) => !usedNext.has(index))
      const leftoverPrev: GroceryItem[] = []
      for (const item of unmatchedPrev) {
        const idx = leftoverNext.findIndex((line) =>
          this.unspecifiedMatchesNumeric(item.quantity, line.quantity),
        )
        if (idx === -1) {
          leftoverPrev.push(item)
          continue
        }
        matched.push({ previous: item, next: leftoverNext.splice(idx, 1)[0]! })
      }

      const leftoverNextAfterEdit = [...leftoverNext]
      for (const item of leftoverPrev) {
        if (!item.quantityManuallyEdited || leftoverNextAfterEdit.length === 0) {
          removed.push(item)
          continue
        }
        matched.push({ previous: item, next: leftoverNextAfterEdit.shift()! })
      }
      added.push(...leftoverNextAfterEdit)
    }

    return { added, removed, matched }
  }

  private resultingQuantity(
    previous: GroceryItem,
    planned: Quantity | null,
    quantityChoices: Record<string, GroceryQuantityChoice>,
  ): Quantity | null {
    if (previous.quantityManuallyEdited && (quantityChoices[previous.id] ?? 'keep') === 'keep') {
      return previous.quantity
    }
    return planned
  }

  private quantityDiffers(a: Quantity | null, b: Quantity | null): boolean {
    if (a === null && b === null) return false
    return this.quantities.compare(a, b) !== 0
  }

  private isQuantityIncrease(from: Quantity | null, to: Quantity | null): boolean {
    return this.quantities.compare(to, from) === 1
  }

  private cookingEventFactor(yieldQty: Quantity, output: Quantity): number | null {
    if (!(yieldQty.value > 0) || !(output.value > 0)) return null
    if (yieldQty.unit === output.unit) return output.value / yieldQty.value
    const outputInYield = this.quantities.convert(output, yieldQty.unit)
    if (!outputInYield || !(outputInYield.value > 0)) return null
    return outputInYield.value / yieldQty.value
  }

  private unspecifiedMatchesNumeric(a: Quantity | null, b: Quantity | null): boolean {
    return (a === null) !== (b === null)
  }

  private sameQuantityBucket(a: Quantity | null, b: Quantity | null): boolean {
    if (a === null && b === null) return true
    if (a === null || b === null) return false
    return this.quantities.canConvert(a, b)
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
    const slotsById = new Map(graph.slots.map((slot) => [slot.id, slot]))

    const cookingEventIds = new Set<string>()
    for (const component of activeComponents) {
      if (component.source.type === 'cooking-event') {
        cookingEventIds.add(component.source.cookingEventId)
      }
    }

    const mealsForCookingEvent = (eventId: string): GroceryItemSource['meals'] => {
      const meals: GroceryItemSource['meals'] = []
      for (const component of activeComponents) {
        if (component.source.type !== 'cooking-event') continue
        if (component.source.cookingEventId !== eventId) continue
        const slot = slotsById.get(component.slotId)
        if (!slot) continue
        meals.push({ slotId: slot.id, date: slot.date, mealType: slot.mealType })
      }
      return meals
    }

    const lines: RequirementLine[] = []

    for (const event of graph.cookingEvents) {
      if (!cookingEventIds.has(event.id)) continue
      const snapshot = event.recipeSnapshot
      const live = await this.recipes.getById(event.recipeId)
      const yieldQty = live?.yield ?? snapshot.yield
      const ingredientLines = live?.ingredientLines ?? snapshot.ingredientLines
      const dishName = live?.name ?? snapshot.name
      const output = event.outputQuantity
      const factor = this.cookingEventFactor(yieldQty, output)
      const meals = mealsForCookingEvent(event.id)

      for (const recipeLine of ingredientLines) {
        const ingredient = recipeLine.ingredientId
          ? await this.ingredients.getById(recipeLine.ingredientId)
          : undefined
        const label = ingredient?.name ?? recipeLine.displayText
        const quantity = factor === null ? null : this.quantities.scale(recipeLine.quantity, factor)
        lines.push({
          ingredientId: recipeLine.ingredientId,
          label,
          quantity,
          sources: [
            {
              kind: 'cooking-event',
              dishName,
              quantity,
              meals,
            },
          ],
        })
      }
    }

    for (const component of activeComponents) {
      if (component.source.type !== 'simple-food') continue
      const food = await this.simpleFoods.getById(component.source.simpleFoodId)
      if (!food) continue
      const ingredient = await this.ingredients.getById(food.ingredientId)
      const slot = slotsById.get(component.slotId)
      lines.push({
        ingredientId: food.ingredientId,
        label: ingredient?.name ?? food.name,
        quantity: component.allocatedQuantity,
        sources: [
          {
            kind: 'simple-food',
            dishName: food.name,
            quantity: component.allocatedQuantity,
            meals: slot ? [{ slotId: slot.id, date: slot.date, mealType: slot.mealType }] : [],
          },
        ],
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
            bucket.sources = [...bucket.sources, ...line.sources]
            merged = true
            break
          }
          if (line.quantity === null || bucket.quantity === null) {
            if (bucket.quantity === null) bucket.quantity = line.quantity
            bucket.sources = [...bucket.sources, ...line.sources]
            merged = true
            break
          }
          if (this.quantities.canConvert(bucket.quantity, line.quantity)) {
            const sum = this.quantities.addForGrocery(bucket.quantity, line.quantity)
            if (sum) {
              bucket.quantity = sum
              bucket.sources = [...bucket.sources, ...line.sources]
              merged = true
              break
            }
          }
        }
        if (!merged) {
          buckets.push({ ...line, sources: [...line.sources] })
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
      let shoppingSection: string | undefined
      if (line.ingredientId) {
        const ingredient = await this.ingredients.getById(line.ingredientId)
        shoppingSection = ingredient?.shoppingSection
        if (priorChecked.has(line.ingredientId)) {
          checked = priorChecked.get(line.ingredientId)!
        } else {
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
        shoppingSection,
        sources: line.sources.length > 0 ? line.sources : undefined,
      })
    }
    await this.groceries.createItems(inputs)
  }
}

function identityKey(line: { ingredientId?: string; label: string }): string {
  return line.ingredientId ? `id:${line.ingredientId}` : `label:${line.label}`
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    const group = grouped.get(key) ?? []
    group.push(item)
    grouped.set(key, group)
  }
  return grouped
}
