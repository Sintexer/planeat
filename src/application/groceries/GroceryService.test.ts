import { describe, expect, it } from 'vitest'
import { GroceryService } from './GroceryService'
import { QuantityService } from '../quantities/QuantityService'
import type {
  CreateGroceryItemInput,
  CreateGroceryListInput,
  GroceryListWithItems,
  GroceryRepository,
  UpdateGroceryItemInput,
} from '../ports/GroceryRepository'
import type { IngredientRepository } from '../ports/IngredientRepository'
import type { PlanRepository } from '../ports/PlanRepository'
import type { SimpleFoodRepository } from '../ports/SimpleFoodRepository'
import type { Ingredient, IngredientId } from '../../domain/ingredients/Ingredient'
import type { GroceryItem, GroceryItemId } from '../../domain/groceries/GroceryItem'
import type { GroceryList, GroceryListId } from '../../domain/groceries/GroceryList'
import type { PlanId } from '../../domain/plans/Plan'
import type { PlanGraph } from '../../domain/plans/PlanGraph'
import type { CookingEvent, RecipeSnapshot } from '../../domain/plans/CookingEvent'
import type { MealComponent } from '../../domain/plans/MealComponent'
import type { MealSlot } from '../../domain/plans/MealSlot'
import type { Recipe, RecipeIngredientLine } from '../../domain/recipes/Recipe'
import type { Quantity } from '../../domain/shared/Quantity'

/** In-memory GroceryRepository test double — no Dexie/IndexedDB needed. */
class FakeGroceryRepository implements GroceryRepository {
  lists = new Map<GroceryListId, GroceryList>()
  items = new Map<GroceryItemId, GroceryItem>()
  private nextListId = 1
  private nextItemId = 1

  async createList(input: CreateGroceryListInput): Promise<GroceryList> {
    const list: GroceryList = {
      id: `list-${this.nextListId++}`,
      title: input.title,
      status: 'open',
      sourcePlanId: input.sourcePlanId,
      sourcePlanRevision: input.sourcePlanRevision,
      createdAt: 0,
      updatedAt: 0,
    }
    this.lists.set(list.id, list)
    return list
  }

  async getList(id: GroceryListId): Promise<GroceryList | undefined> {
    return this.lists.get(id)
  }

  async getListWithItems(id: GroceryListId): Promise<GroceryListWithItems | undefined> {
    const list = this.lists.get(id)
    if (!list) return undefined
    return { list, items: [...this.items.values()].filter((item) => item.listId === id) }
  }

  async listAll(): Promise<GroceryList[]> {
    return [...this.lists.values()]
  }

  async findOpenBySourcePlanId(planId: PlanId): Promise<GroceryList | undefined> {
    return [...this.lists.values()].find(
      (list) => list.status === 'open' && list.sourcePlanId === planId,
    )
  }

  async updateList(
    id: GroceryListId,
    changes: Partial<Pick<GroceryList, 'title' | 'status' | 'sourcePlanId' | 'sourcePlanRevision'>>,
  ): Promise<void> {
    const current = this.lists.get(id)
    if (!current) return
    this.lists.set(id, { ...current, ...changes })
  }

  async deleteList(id: GroceryListId): Promise<void> {
    this.lists.delete(id)
    for (const [itemId, item] of this.items) {
      if (item.listId === id) this.items.delete(itemId)
    }
  }

  async createItem(input: CreateGroceryItemInput): Promise<GroceryItem> {
    const item: GroceryItem = {
      id: `item-${this.nextItemId++}`,
      listId: input.listId,
      label: input.label,
      ingredientId: input.ingredientId,
      quantity: input.quantity,
      checked: input.checked ?? false,
      origin: input.origin,
      quantityManuallyEdited: input.quantityManuallyEdited ?? false,
    }
    this.items.set(item.id, item)
    return item
  }

  async createItems(inputs: CreateGroceryItemInput[]): Promise<GroceryItem[]> {
    return Promise.all(inputs.map((input) => this.createItem(input)))
  }

  async getItem(id: GroceryItemId): Promise<GroceryItem | undefined> {
    return this.items.get(id)
  }

  async getItemsForList(listId: GroceryListId): Promise<GroceryItem[]> {
    return [...this.items.values()].filter((item) => item.listId === listId)
  }

  async updateItem(id: GroceryItemId, changes: UpdateGroceryItemInput): Promise<void> {
    const current = this.items.get(id)
    if (!current) return
    this.items.set(id, { ...current, ...changes })
  }

  async deleteItem(id: GroceryItemId): Promise<void> {
    this.items.delete(id)
  }

  async deleteGeneratedItems(listId: GroceryListId): Promise<void> {
    for (const [itemId, item] of this.items) {
      if (item.listId === listId && item.origin === 'generated') this.items.delete(itemId)
    }
  }
}

/** In-memory PlanRepository test double — only `getGraph` is used by GroceryService. */
class FakePlanRepository implements PlanRepository {
  private graph: PlanGraph

  constructor(graph: PlanGraph) {
    this.graph = graph
  }

  setGraph(graph: PlanGraph) {
    this.graph = graph
  }

  async getGraph(id: PlanId): Promise<PlanGraph | undefined> {
    return this.graph.plan.id === id ? this.graph : undefined
  }

  getById: PlanRepository['getById'] = () => {
    throw new Error('not implemented')
  }
  getByStartDate: PlanRepository['getByStartDate'] = () => {
    throw new Error('not implemented')
  }
  createPlanWithSlots: PlanRepository['createPlanWithSlots'] = () => {
    throw new Error('not implemented')
  }
  getSlot: PlanRepository['getSlot'] = () => {
    throw new Error('not implemented')
  }
  setSlotExcluded: PlanRepository['setSlotExcluded'] = () => {
    throw new Error('not implemented')
  }
  addCookingEventComponent: PlanRepository['addCookingEventComponent'] = () => {
    throw new Error('not implemented')
  }
  linkCookingEventComponent: PlanRepository['linkCookingEventComponent'] = () => {
    throw new Error('not implemented')
  }
  addSimpleFoodComponent: PlanRepository['addSimpleFoodComponent'] = () => {
    throw new Error('not implemented')
  }
  updateComponentAllocation: PlanRepository['updateComponentAllocation'] = () => {
    throw new Error('not implemented')
  }
  removeComponent: PlanRepository['removeComponent'] = () => {
    throw new Error('not implemented')
  }
  updateCookingEvent: PlanRepository['updateCookingEvent'] = () => {
    throw new Error('not implemented')
  }
  listCookingEventDependents: PlanRepository['listCookingEventDependents'] = () => {
    throw new Error('not implemented')
  }
  getComponent: PlanRepository['getComponent'] = () => {
    throw new Error('not implemented')
  }
  clearSlot: PlanRepository['clearSlot'] = () => {
    throw new Error('not implemented')
  }
  bumpRevision: PlanRepository['bumpRevision'] = () => {
    throw new Error('not implemented')
  }
  listComponentsForSlot: PlanRepository['listComponentsForSlot'] = () => {
    throw new Error('not implemented')
  }
  getCookingEvent: PlanRepository['getCookingEvent'] = () => {
    throw new Error('not implemented')
  }
}

/** In-memory IngredientRepository test double — only `getById` is used by GroceryService. */
class FakeIngredientRepository implements IngredientRepository {
  private rows: Map<IngredientId, Ingredient>

  constructor(rows: Map<IngredientId, Ingredient>) {
    this.rows = rows
  }

  async getById(id: IngredientId): Promise<Ingredient | undefined> {
    return this.rows.get(id)
  }

  create: IngredientRepository['create'] = () => {
    throw new Error('not implemented')
  }
  getAll: IngredientRepository['getAll'] = () => {
    throw new Error('not implemented')
  }
  findByNameOrAlias: IngredientRepository['findByNameOrAlias'] = () => {
    throw new Error('not implemented')
  }
  findCandidatesByName: IngredientRepository['findCandidatesByName'] = () => {
    throw new Error('not implemented')
  }
  update: IngredientRepository['update'] = () => {
    throw new Error('not implemented')
  }
  remove: IngredientRepository['remove'] = () => {
    throw new Error('not implemented')
  }
}

/** In-memory SimpleFoodRepository test double — unused by these scenarios. */
class FakeSimpleFoodRepository implements SimpleFoodRepository {
  create: SimpleFoodRepository['create'] = () => {
    throw new Error('not implemented')
  }
  getAll: SimpleFoodRepository['getAll'] = () => {
    throw new Error('not implemented')
  }
  getById: SimpleFoodRepository['getById'] = () => Promise.resolve(undefined)
  update: SimpleFoodRepository['update'] = () => {
    throw new Error('not implemented')
  }
  remove: SimpleFoodRepository['remove'] = () => {
    throw new Error('not implemented')
  }
}

function baseIngredientLine(ingredientId: string, quantity: Quantity | null): RecipeIngredientLine {
  return { ingredientId, quantity, displayText: ingredientId }
}

function baseRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'recipe-1',
    name: 'Soup',
    yield: { value: 4, unit: 'serving' },
    defaultPortionPerPerson: { value: 1, unit: 'serving' },
    ingredientLines: [],
    instructions: '',
    roles: ['complete'],
    mealTypes: ['dinner'],
    effort: 'regular',
    reusePolicy: 'batch-friendly',
    freezerFriendly: false,
    tagIds: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

function toSnapshot(recipe: Recipe): RecipeSnapshot {
  const { tagIds, ...rest } = recipe
  void tagIds
  return { ...rest, tags: [] }
}

function buildCookingEvent(overrides: {
  id: string
  planId: string
  ingredientLines: RecipeIngredientLine[]
  yieldQty: Quantity
  outputQuantity: Quantity
}): CookingEvent {
  return {
    id: overrides.id,
    planId: overrides.planId,
    sessionId: 'session-1',
    recipeId: 'recipe-1',
    recipeSnapshot: toSnapshot(
      baseRecipe({ yield: overrides.yieldQty, ingredientLines: overrides.ingredientLines }),
    ),
    outputQuantity: overrides.outputQuantity,
    scheduledDate: '2026-01-01',
  }
}

function buildComponent(slotId: string, cookingEventId: string): MealComponent {
  return {
    id: `component-${slotId}-${cookingEventId}`,
    slotId,
    source: { type: 'cooking-event', cookingEventId },
    allocatedQuantity: { value: 1, unit: 'serving' },
  }
}

function buildSlot(id: string, excluded = false): MealSlot {
  return { id, planId: 'plan-1', date: '2026-01-01', mealType: 'dinner', excluded }
}

function buildGraph(overrides: {
  cookingEvents: CookingEvent[]
  components: MealComponent[]
  slots?: MealSlot[]
}): PlanGraph {
  return {
    plan: {
      id: 'plan-1',
      startDate: '2026-01-01',
      dayCount: 7,
      peopleCount: 2,
      revision: 1,
      preferences: {},
      createdAt: 0,
      updatedAt: 0,
    },
    slots: overrides.slots ?? [buildSlot('slot-1')],
    components: overrides.components,
    cookingEvents: overrides.cookingEvents,
    prepSessions: [],
  }
}

function makeService(graph: PlanGraph, ingredients: Map<IngredientId, Ingredient> = new Map()) {
  const groceries = new FakeGroceryRepository()
  const plans = new FakePlanRepository(graph)
  const ingredientRepo = new FakeIngredientRepository(ingredients)
  const simpleFoods = new FakeSimpleFoodRepository()
  const quantities = new QuantityService()
  const service = new GroceryService(groceries, plans, ingredientRepo, simpleFoods, quantities)
  return { service, groceries, plans }
}

describe('GroceryService.generateFromPlan aggregation', () => {
  it('500 g + 1 kg of the same ingredient merges into one 1.5 kg line', async () => {
    const graph = buildGraph({
      cookingEvents: [
        buildCookingEvent({
          id: 'event-1',
          planId: 'plan-1',
          ingredientLines: [baseIngredientLine('flour', { value: 500, unit: 'g' })],
          yieldQty: { value: 1, unit: 'serving' },
          outputQuantity: { value: 1, unit: 'serving' },
        }),
        buildCookingEvent({
          id: 'event-2',
          planId: 'plan-1',
          ingredientLines: [baseIngredientLine('flour', { value: 1, unit: 'kg' })],
          yieldQty: { value: 1, unit: 'serving' },
          outputQuantity: { value: 1, unit: 'serving' },
        }),
      ],
      components: [buildComponent('slot-1', 'event-1'), buildComponent('slot-1', 'event-2')],
    })
    const { service, groceries } = makeService(graph)

    const result = await service.generateFromPlan('plan-1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const items = await groceries.getItemsForList(result.list.id)
    const flourItems = items.filter((item) => item.ingredientId === 'flour')
    expect(flourItems).toHaveLength(1)
    // The first-seen line's unit wins the bucket (500 g arrives before 1 kg).
    expect(flourItems[0]?.quantity).toEqual({ value: 1500, unit: 'g' })
  })

  it('200 g flour and 1 cup flour remain two separate lines', async () => {
    const graph = buildGraph({
      cookingEvents: [
        buildCookingEvent({
          id: 'event-1',
          planId: 'plan-1',
          ingredientLines: [baseIngredientLine('flour', { value: 200, unit: 'g' })],
          yieldQty: { value: 1, unit: 'serving' },
          outputQuantity: { value: 1, unit: 'serving' },
        }),
        buildCookingEvent({
          id: 'event-2',
          planId: 'plan-1',
          ingredientLines: [baseIngredientLine('flour', { value: 1, unit: 'cup' })],
          yieldQty: { value: 1, unit: 'serving' },
          outputQuantity: { value: 1, unit: 'serving' },
        }),
      ],
      components: [buildComponent('slot-1', 'event-1'), buildComponent('slot-1', 'event-2')],
    })
    const { service, groceries } = makeService(graph)

    const result = await service.generateFromPlan('plan-1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const items = await groceries.getItemsForList(result.list.id)
    const flourItems = items.filter((item) => item.ingredientId === 'flour')
    expect(flourItems).toHaveLength(2)
    const units = flourItems.map((item) => item.quantity?.unit).sort()
    expect(units).toEqual(['cup', 'g'])
  })

  it('an unspecified cup stays unspecified when combined with ml', async () => {
    const graph = buildGraph({
      cookingEvents: [
        buildCookingEvent({
          id: 'event-1',
          planId: 'plan-1',
          ingredientLines: [baseIngredientLine('milk', { value: 1, unit: 'cup' })],
          yieldQty: { value: 1, unit: 'serving' },
          outputQuantity: { value: 1, unit: 'serving' },
        }),
        buildCookingEvent({
          id: 'event-2',
          planId: 'plan-1',
          ingredientLines: [baseIngredientLine('milk', { value: 240, unit: 'ml' })],
          yieldQty: { value: 1, unit: 'serving' },
          outputQuantity: { value: 1, unit: 'serving' },
        }),
      ],
      components: [buildComponent('slot-1', 'event-1'), buildComponent('slot-1', 'event-2')],
    })
    const { service, groceries } = makeService(graph)

    const result = await service.generateFromPlan('plan-1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const items = await groceries.getItemsForList(result.list.id)
    const milkItems = items.filter((item) => item.ingredientId === 'milk')
    expect(milkItems).toHaveLength(2)
  })

  it('oz-mass merges with g', async () => {
    const graph = buildGraph({
      cookingEvents: [
        buildCookingEvent({
          id: 'event-1',
          planId: 'plan-1',
          ingredientLines: [baseIngredientLine('butter', { value: 100, unit: 'g' })],
          yieldQty: { value: 1, unit: 'serving' },
          outputQuantity: { value: 1, unit: 'serving' },
        }),
        buildCookingEvent({
          id: 'event-2',
          planId: 'plan-1',
          ingredientLines: [baseIngredientLine('butter', { value: 1, unit: 'oz-mass' })],
          yieldQty: { value: 1, unit: 'serving' },
          outputQuantity: { value: 1, unit: 'serving' },
        }),
      ],
      components: [buildComponent('slot-1', 'event-1'), buildComponent('slot-1', 'event-2')],
    })
    const { service, groceries } = makeService(graph)

    const result = await service.generateFromPlan('plan-1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const items = await groceries.getItemsForList(result.list.id)
    expect(items.filter((item) => item.ingredientId === 'butter')).toHaveLength(1)
  })

  it('cup-metric never merges with anything but another cup-metric line', async () => {
    const graph = buildGraph({
      cookingEvents: [
        buildCookingEvent({
          id: 'event-1',
          planId: 'plan-1',
          ingredientLines: [baseIngredientLine('milk', { value: 1, unit: 'cup-metric' })],
          yieldQty: { value: 1, unit: 'serving' },
          outputQuantity: { value: 1, unit: 'serving' },
        }),
        buildCookingEvent({
          id: 'event-2',
          planId: 'plan-1',
          ingredientLines: [baseIngredientLine('milk', { value: 1, unit: 'cup-metric' })],
          yieldQty: { value: 1, unit: 'serving' },
          outputQuantity: { value: 1, unit: 'serving' },
        }),
        buildCookingEvent({
          id: 'event-3',
          planId: 'plan-1',
          ingredientLines: [baseIngredientLine('milk', { value: 250, unit: 'ml' })],
          yieldQty: { value: 1, unit: 'serving' },
          outputQuantity: { value: 1, unit: 'serving' },
        }),
      ],
      components: [
        buildComponent('slot-1', 'event-1'),
        buildComponent('slot-1', 'event-2'),
        buildComponent('slot-1', 'event-3'),
      ],
    })
    const { service, groceries } = makeService(graph)

    const result = await service.generateFromPlan('plan-1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const items = await groceries.getItemsForList(result.list.id)
    const milkItems = items.filter((item) => item.ingredientId === 'milk')
    expect(milkItems).toHaveLength(2)
    const cupMetric = milkItems.find((item) => item.quantity?.unit === 'cup-metric')
    expect(cupMetric?.quantity).toEqual({ value: 2, unit: 'cup-metric' })
  })
})

describe('GroceryService.generateFromPlan leftover reuse', () => {
  it('the same cooking event referenced by two meal components is scaled once, not twice', async () => {
    const graph = buildGraph({
      cookingEvents: [
        buildCookingEvent({
          id: 'event-1',
          planId: 'plan-1',
          ingredientLines: [baseIngredientLine('chicken', { value: 1, unit: 'kg' })],
          yieldQty: { value: 4, unit: 'serving' },
          outputQuantity: { value: 4, unit: 'serving' },
        }),
      ],
      // Two meal components (e.g. two days' dinners) both reuse the same cooking event.
      components: [buildComponent('slot-1', 'event-1'), buildComponent('slot-2', 'event-1')],
      slots: [buildSlot('slot-1'), buildSlot('slot-2')],
    })
    const { service, groceries } = makeService(graph)

    const result = await service.generateFromPlan('plan-1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const items = await groceries.getItemsForList(result.list.id)
    const chickenItems = items.filter((item) => item.ingredientId === 'chicken')
    expect(chickenItems).toHaveLength(1)
    // factor = output(4) / yield(4) = 1, applied once — not once per referencing component.
    expect(chickenItems[0]?.quantity).toEqual({ value: 1, unit: 'kg' })
  })
})

describe('GroceryService.updateFromPlan manual-item preservation', () => {
  it('preserves a manually added item untouched across a regeneration', async () => {
    const graph = buildGraph({
      cookingEvents: [
        buildCookingEvent({
          id: 'event-1',
          planId: 'plan-1',
          ingredientLines: [baseIngredientLine('flour', { value: 200, unit: 'g' })],
          yieldQty: { value: 1, unit: 'serving' },
          outputQuantity: { value: 1, unit: 'serving' },
        }),
      ],
      components: [buildComponent('slot-1', 'event-1')],
    })
    const { service, groceries, plans } = makeService(graph)

    const generated = await service.generateFromPlan('plan-1')
    expect(generated.ok).toBe(true)
    if (!generated.ok) return

    const manual = await service.addManualItem(generated.list.id, 'Paper towels', {
      value: 1,
      unit: 'piece',
    })
    expect(manual.ok).toBe(true)
    if (!manual.ok) return
    const manualBefore = await groceries.getItem(manual.item.id)

    // Change the underlying plan so the revised aggregation produces a different grouping.
    plans.setGraph(
      buildGraph({
        cookingEvents: [
          buildCookingEvent({
            id: 'event-1',
            planId: 'plan-1',
            ingredientLines: [baseIngredientLine('flour', { value: 1, unit: 'cup-us' })],
            yieldQty: { value: 1, unit: 'serving' },
            outputQuantity: { value: 1, unit: 'serving' },
          }),
        ],
        components: [buildComponent('slot-1', 'event-1')],
      }),
    )

    const updated = await service.updateFromPlan(generated.list.id)
    expect(updated.ok).toBe(true)

    const manualAfter = await groceries.getItem(manual.item.id)
    expect(manualAfter).toEqual(manualBefore)

    const allItems = await groceries.getItemsForList(generated.list.id)
    const flourItem = allItems.find((item) => item.ingredientId === 'flour')
    expect(flourItem?.quantity).toEqual({ value: 1, unit: 'cup-us' })
    expect(allItems.some((item) => item.id === manual.item.id)).toBe(true)
  })

  it('preserves checked state for a generated item whose ingredient still appears', async () => {
    const ingredients = new Map<IngredientId, Ingredient>([
      [
        'flour',
        {
          id: 'flour',
          name: 'Flour',
          aliases: [],
          isCommon: false,
          createdAt: 0,
          updatedAt: 0,
        },
      ],
    ])
    const graph = buildGraph({
      cookingEvents: [
        buildCookingEvent({
          id: 'event-1',
          planId: 'plan-1',
          ingredientLines: [baseIngredientLine('flour', { value: 200, unit: 'g' })],
          yieldQty: { value: 1, unit: 'serving' },
          outputQuantity: { value: 1, unit: 'serving' },
        }),
      ],
      components: [buildComponent('slot-1', 'event-1')],
    })
    const { service, groceries } = makeService(graph, ingredients)

    const generated = await service.generateFromPlan('plan-1')
    expect(generated.ok).toBe(true)
    if (!generated.ok) return
    const items = await groceries.getItemsForList(generated.list.id)
    const flourItem = items.find((item) => item.ingredientId === 'flour')
    expect(flourItem).toBeDefined()
    if (!flourItem) return
    await service.toggleChecked(flourItem.id)

    const updated = await service.updateFromPlan(generated.list.id)
    expect(updated.ok).toBe(true)

    const itemsAfter = await groceries.getItemsForList(generated.list.id)
    const flourItemAfter = itemsAfter.find((item) => item.ingredientId === 'flour')
    expect(flourItemAfter?.checked).toBe(true)
  })
})
