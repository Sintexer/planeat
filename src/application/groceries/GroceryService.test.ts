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
import type { RecipeRepository } from '../ports/RecipeRepository'
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
import type { SimpleFood, SimpleFoodId } from '../../domain/simpleFoods/SimpleFood'

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
      shoppingSection: input.shoppingSection,
      sources: input.sources,
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
  addCookingEventComponents: PlanRepository['addCookingEventComponents'] = () => {
    throw new Error('not implemented')
  }
  linkCookingEventComponent: PlanRepository['linkCookingEventComponent'] = () => {
    throw new Error('not implemented')
  }
  addSimpleFoodComponent: PlanRepository['addSimpleFoodComponent'] = () => {
    throw new Error('not implemented')
  }
  addGeneratedComponents: PlanRepository['addGeneratedComponents'] = () => {
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

/** In-memory SimpleFoodRepository test double — `getById` used for simple-food grocery lines. */
class FakeSimpleFoodRepository implements SimpleFoodRepository {
  private rows: Map<SimpleFoodId, SimpleFood>

  constructor(rows: Map<SimpleFoodId, SimpleFood> = new Map()) {
    this.rows = rows
  }

  async getById(id: SimpleFoodId): Promise<SimpleFood | undefined> {
    return this.rows.get(id)
  }

  create: SimpleFoodRepository['create'] = () => {
    throw new Error('not implemented')
  }
  getAll: SimpleFoodRepository['getAll'] = () => {
    throw new Error('not implemented')
  }
  update: SimpleFoodRepository['update'] = () => {
    throw new Error('not implemented')
  }
  remove: SimpleFoodRepository['remove'] = () => {
    throw new Error('not implemented')
  }
}

class FakeRecipeRepository implements RecipeRepository {
  private rows: Map<string, Recipe>

  constructor(rows: Map<string, Recipe> = new Map()) {
    this.rows = rows
  }

  async getById(id: string): Promise<Recipe | undefined> {
    return this.rows.get(id)
  }

  create: RecipeRepository['create'] = () => {
    throw new Error('not implemented')
  }
  getAll: RecipeRepository['getAll'] = () => {
    throw new Error('not implemented')
  }
  update: RecipeRepository['update'] = () => {
    throw new Error('not implemented')
  }
  remove: RecipeRepository['remove'] = () => {
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
  name?: string
}): CookingEvent {
  return {
    id: overrides.id,
    planId: overrides.planId,
    sessionId: 'session-1',
    recipeId: 'recipe-1',
    recipeSnapshot: toSnapshot(
      baseRecipe({
        name: overrides.name ?? 'Soup',
        yield: overrides.yieldQty,
        ingredientLines: overrides.ingredientLines,
      }),
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

function buildSlot(
  id: string,
  excluded = false,
  date = '2026-01-01',
  mealType: MealSlot['mealType'] = 'dinner',
): MealSlot {
  return { id, planId: 'plan-1', date, mealType, excluded }
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

function makeService(
  graph: PlanGraph,
  ingredients: Map<IngredientId, Ingredient> = new Map(),
  foods: Map<SimpleFoodId, SimpleFood> = new Map(),
  recipes: Map<string, Recipe> = new Map(),
) {
  const groceries = new FakeGroceryRepository()
  const plans = new FakePlanRepository(graph)
  const ingredientRepo = new FakeIngredientRepository(ingredients)
  const simpleFoods = new FakeSimpleFoodRepository(foods)
  const quantities = new QuantityService()
  const recipeRepo = new FakeRecipeRepository(recipes)
  const service = new GroceryService(
    groceries,
    plans,
    ingredientRepo,
    simpleFoods,
    quantities,
    recipeRepo,
  )
  return { service, groceries, plans }
}

describe('GroceryService.generateFromPlan aggregation', () => {
  it('500 g + 1 kg of the same ingredient merges into one 1.5 kg line', async () => {
    const graph = buildGraph({
      cookingEvents: [
        buildCookingEvent({
          id: 'event-1',
          planId: 'plan-1',
          name: 'Curry',
          ingredientLines: [baseIngredientLine('rice', { value: 500, unit: 'g' })],
          yieldQty: { value: 1, unit: 'serving' },
          outputQuantity: { value: 1, unit: 'serving' },
        }),
        buildCookingEvent({
          id: 'event-2',
          planId: 'plan-1',
          name: 'Rice bake',
          ingredientLines: [baseIngredientLine('rice', { value: 1, unit: 'kg' })],
          yieldQty: { value: 1, unit: 'serving' },
          outputQuantity: { value: 1, unit: 'serving' },
        }),
      ],
      components: [buildComponent('slot-1', 'event-1'), buildComponent('slot-2', 'event-2')],
      slots: [
        buildSlot('slot-1', false, '2026-01-06', 'dinner'),
        buildSlot('slot-2', false, '2026-01-09', 'dinner'),
      ],
    })
    const { service, groceries } = makeService(graph)

    const result = await service.generateFromPlan('plan-1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const items = await groceries.getItemsForList(result.list.id)
    const riceItems = items.filter((item) => item.ingredientId === 'rice')
    expect(riceItems).toHaveLength(1)
    // The first-seen line's unit wins the bucket (500 g arrives before 1 kg).
    expect(riceItems[0]?.quantity).toEqual({ value: 1500, unit: 'g' })
    expect(riceItems[0]?.sources).toEqual([
      {
        kind: 'cooking-event',
        dishName: 'Curry',
        quantity: { value: 500, unit: 'g' },
        meals: [{ slotId: 'slot-1', date: '2026-01-06', mealType: 'dinner' }],
      },
      {
        kind: 'cooking-event',
        dishName: 'Rice bake',
        quantity: { value: 1, unit: 'kg' },
        meals: [{ slotId: 'slot-2', date: '2026-01-09', mealType: 'dinner' }],
      },
    ])
  })

  it('merges an unspecified amount into the same ingredient numeric total', async () => {
    const graph = buildGraph({
      cookingEvents: [
        buildCookingEvent({
          id: 'event-1',
          planId: 'plan-1',
          name: 'Kasha',
          ingredientLines: [baseIngredientLine('salt', { value: 2, unit: 'tsp' })],
          yieldQty: { value: 1, unit: 'serving' },
          outputQuantity: { value: 1, unit: 'serving' },
        }),
        buildCookingEvent({
          id: 'event-2',
          planId: 'plan-1',
          name: 'Cutlets',
          ingredientLines: [baseIngredientLine('salt', null)],
          yieldQty: { value: 12, unit: 'piece' },
          outputQuantity: { value: 6, unit: 'serving' },
        }),
      ],
      components: [buildComponent('slot-1', 'event-1'), buildComponent('slot-2', 'event-2')],
      slots: [buildSlot('slot-1'), buildSlot('slot-2')],
    })
    const { service, groceries } = makeService(graph)

    const result = await service.generateFromPlan('plan-1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const saltItems = (await groceries.getItemsForList(result.list.id)).filter(
      (item) => item.ingredientId === 'salt',
    )
    expect(saltItems).toHaveLength(1)
    expect(saltItems[0]?.quantity).toEqual({ value: 2, unit: 'tsp' })
    expect(saltItems[0]?.sources).toEqual([
      expect.objectContaining({ dishName: 'Kasha', quantity: { value: 2, unit: 'tsp' } }),
      expect.objectContaining({ dishName: 'Cutlets', quantity: null }),
    ])
  })

  it('scales when yield and output use convertible units', async () => {
    const graph = buildGraph({
      cookingEvents: [
        buildCookingEvent({
          id: 'event-1',
          planId: 'plan-1',
          ingredientLines: [baseIngredientLine('salt', { value: 2, unit: 'tsp' })],
          yieldQty: { value: 1, unit: 'kg' },
          outputQuantity: { value: 500, unit: 'g' },
        }),
      ],
      components: [buildComponent('slot-1', 'event-1')],
    })
    const { service, groceries } = makeService(graph)
    const result = await service.generateFromPlan('plan-1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const salt = (await groceries.getItemsForList(result.list.id)).find(
      (item) => item.ingredientId === 'salt',
    )
    expect(salt?.quantity).toEqual({ value: 1, unit: 'tsp' })
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
    expect(flourItems.map((item) => item.sources)).toEqual([
      [
        expect.objectContaining({
          kind: 'cooking-event',
          quantity: { value: 200, unit: 'g' },
        }),
      ],
      [
        expect.objectContaining({
          kind: 'cooking-event',
          quantity: { value: 1, unit: 'cup' },
        }),
      ],
    ])
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
  // Sprint 34 generate-apply only links existing cooking events. Grocery lists stay
  // untouched until the cook later generates/updates a list; this fixture is that proof.
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
    expect(chickenItems[0]?.sources).toHaveLength(1)
    expect(chickenItems[0]?.sources?.[0]?.meals).toHaveLength(2)
    expect(chickenItems[0]?.sources?.[0]?.quantity).toEqual({ value: 1, unit: 'kg' })
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
    expect(manualAfter?.sources).toBeUndefined()
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
    expect(flourItemAfter?.id).toBe(flourItem.id)
  })

  it('emits a grocery row for an unlinked recipe line using displayText', async () => {
    const graph = buildGraph({
      cookingEvents: [
        buildCookingEvent({
          id: 'event-1',
          planId: 'plan-1',
          ingredientLines: [
            {
              quantity: { value: 2, unit: 'cup' },
              displayText: 'flour',
              sourceText: '2 cups flour',
            },
          ],
          yieldQty: { value: 1, unit: 'serving' },
          outputQuantity: { value: 1, unit: 'serving' },
        }),
      ],
      components: [buildComponent('slot-1', 'event-1')],
    })
    const { service, groceries } = makeService(graph)

    const result = await service.generateFromPlan('plan-1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const items = await groceries.getItemsForList(result.list.id)
    expect(items).toHaveLength(1)
    expect(items[0]?.ingredientId).toBeUndefined()
    expect(items[0]?.label).toBe('flour')
    expect(items[0]?.quantity).toEqual({ value: 2, unit: 'cup' })
  })
})

describe('GroceryService preview and patch-in-place update', () => {
  const flourGraph = (quantity: Quantity) =>
    buildGraph({
      cookingEvents: [
        buildCookingEvent({
          id: 'event-1',
          planId: 'plan-1',
          ingredientLines: [baseIngredientLine('flour', quantity)],
          yieldQty: { value: 1, unit: 'serving' },
          outputQuantity: { value: 1, unit: 'serving' },
        }),
      ],
      components: [buildComponent('slot-1', 'event-1')],
    })

  it('previews added, changed, and removed generated lines without writing', async () => {
    const { service, groceries, plans } = makeService(flourGraph({ value: 200, unit: 'g' }))
    const generated = await service.generateFromPlan('plan-1')
    expect(generated.ok).toBe(true)
    if (!generated.ok) return
    await service.addManualItem(generated.list.id, 'Paper towels')

    plans.setGraph(
      buildGraph({
        cookingEvents: [
          buildCookingEvent({
            id: 'event-1',
            planId: 'plan-1',
            ingredientLines: [
              baseIngredientLine('flour', { value: 400, unit: 'g' }),
              baseIngredientLine('carrot', { value: 500, unit: 'g' }),
            ],
            yieldQty: { value: 1, unit: 'serving' },
            outputQuantity: { value: 1, unit: 'serving' },
          }),
        ],
        components: [buildComponent('slot-1', 'event-1')],
      }),
    )

    const before = structuredClone(await groceries.getItemsForList(generated.list.id))
    const preview = await service.previewUpdateFromPlan(generated.list.id)
    expect(preview.ok).toBe(true)
    if (!preview.ok) return
    expect(preview.preview.changed).toHaveLength(1)
    expect(preview.preview.changed[0]?.from).toEqual({ value: 200, unit: 'g' })
    expect(preview.preview.changed[0]?.to).toEqual({ value: 400, unit: 'g' })
    expect(preview.preview.added.map((line) => line.label)).toEqual(['carrot'])
    expect(preview.preview.removed).toHaveLength(0)
    expect(preview.preview.manualKeptCount).toBe(1)
    expect(await groceries.getItemsForList(generated.list.id)).toEqual(before)
  })

  it('does not list convert-equal quantities as changed', async () => {
    const { service, plans } = makeService(flourGraph({ value: 1, unit: 'kg' }))
    const generated = await service.generateFromPlan('plan-1')
    expect(generated.ok).toBe(true)
    if (!generated.ok) return
    plans.setGraph(flourGraph({ value: 1000, unit: 'g' }))
    const preview = await service.previewUpdateFromPlan(generated.list.id)
    expect(preview.ok).toBe(true)
    if (!preview.ok) return
    expect(preview.preview.changed).toHaveLength(0)
    expect(preview.preview.added).toHaveLength(0)
    expect(preview.preview.removed).toHaveLength(0)
    expect(preview.preview.unchangedCount).toBe(1)
  })

  it('keeps an overridden quantity by default and applies use-plan when chosen', async () => {
    const { service, groceries, plans } = makeService(flourGraph({ value: 200, unit: 'g' }))
    const generated = await service.generateFromPlan('plan-1')
    expect(generated.ok).toBe(true)
    if (!generated.ok) return
    const flour = (await groceries.getItemsForList(generated.list.id)).find(
      (item) => item.ingredientId === 'flour',
    )
    expect(flour).toBeDefined()
    if (!flour) return
    await service.updateItem(flour.id, { quantity: { value: 250, unit: 'g' } })
    plans.setGraph(flourGraph({ value: 400, unit: 'g' }))

    const preview = await service.previewUpdateFromPlan(generated.list.id)
    expect(preview.ok).toBe(true)
    if (!preview.ok) return
    expect(preview.preview.overrides).toHaveLength(1)
    expect(preview.preview.changed).toHaveLength(0)
    expect(preview.preview.overrides[0]?.current).toEqual({ value: 250, unit: 'g' })
    expect(preview.preview.overrides[0]?.planned).toEqual({ value: 400, unit: 'g' })

    const kept = await service.updateFromPlan(generated.list.id)
    expect(kept.ok).toBe(true)
    const afterKeep = (await groceries.getItemsForList(generated.list.id)).find(
      (item) => item.ingredientId === 'flour',
    )
    expect(afterKeep?.id).toBe(flour.id)
    expect(afterKeep?.quantity).toEqual({ value: 250, unit: 'g' })
    expect(afterKeep?.quantityManuallyEdited).toBe(true)

    plans.setGraph(flourGraph({ value: 500, unit: 'g' }))
    const usedPlan = await service.updateFromPlan(generated.list.id, {
      quantityChoices: { [flour.id]: 'use-plan' },
    })
    expect(usedPlan.ok).toBe(true)
    const afterPlan = (await groceries.getItemsForList(generated.list.id)).find(
      (item) => item.ingredientId === 'flour',
    )
    expect(afterPlan?.quantity).toEqual({ value: 500, unit: 'g' })
    expect(afterPlan?.quantityManuallyEdited).toBe(false)
  })

  it('unchecks a checked item when the required quantity increases', async () => {
    const { service, groceries, plans } = makeService(flourGraph({ value: 200, unit: 'g' }))
    const generated = await service.generateFromPlan('plan-1')
    expect(generated.ok).toBe(true)
    if (!generated.ok) return
    const flour = (await groceries.getItemsForList(generated.list.id)).find(
      (item) => item.ingredientId === 'flour',
    )
    expect(flour).toBeDefined()
    if (!flour) return
    await service.toggleChecked(flour.id)
    plans.setGraph(flourGraph({ value: 400, unit: 'g' }))

    const preview = await service.previewUpdateFromPlan(generated.list.id)
    expect(preview.ok).toBe(true)
    if (!preview.ok) return
    expect(preview.preview.willUncheck).toHaveLength(1)
    expect(preview.preview.willUncheck[0]?.from).toEqual({ value: 200, unit: 'g' })
    expect(preview.preview.willUncheck[0]?.to).toEqual({ value: 400, unit: 'g' })

    const updated = await service.updateFromPlan(generated.list.id)
    expect(updated.ok).toBe(true)
    const after = (await groceries.getItemsForList(generated.list.id)).find(
      (item) => item.ingredientId === 'flour',
    )
    expect(after?.checked).toBe(false)
    expect(after?.quantity).toEqual({ value: 400, unit: 'g' })
  })

  it('keeps a check when the required quantity decreases', async () => {
    const { service, groceries, plans } = makeService(flourGraph({ value: 400, unit: 'g' }))
    const generated = await service.generateFromPlan('plan-1')
    expect(generated.ok).toBe(true)
    if (!generated.ok) return
    const flour = (await groceries.getItemsForList(generated.list.id)).find(
      (item) => item.ingredientId === 'flour',
    )
    expect(flour).toBeDefined()
    if (!flour) return
    await service.toggleChecked(flour.id)
    plans.setGraph(flourGraph({ value: 200, unit: 'g' }))

    const preview = await service.previewUpdateFromPlan(generated.list.id)
    expect(preview.ok).toBe(true)
    if (!preview.ok) return
    expect(preview.preview.willUncheck).toHaveLength(0)

    await service.updateFromPlan(generated.list.id)
    const after = (await groceries.getItemsForList(generated.list.id)).find(
      (item) => item.ingredientId === 'flour',
    )
    expect(after?.checked).toBe(true)
    expect(after?.quantity).toEqual({ value: 200, unit: 'g' })
  })

  it('treats incompatible unit buckets for one ingredient as separate lines', async () => {
    const mixed = buildGraph({
      cookingEvents: [
        buildCookingEvent({
          id: 'event-1',
          planId: 'plan-1',
          ingredientLines: [
            baseIngredientLine('flour', { value: 200, unit: 'g' }),
            baseIngredientLine('flour', { value: 2, unit: 'piece' }),
          ],
          yieldQty: { value: 1, unit: 'serving' },
          outputQuantity: { value: 1, unit: 'serving' },
        }),
      ],
      components: [buildComponent('slot-1', 'event-1')],
    })
    const { service, groceries, plans } = makeService(mixed)
    const generated = await service.generateFromPlan('plan-1')
    expect(generated.ok).toBe(true)
    if (!generated.ok) return
    expect(await groceries.getItemsForList(generated.list.id)).toHaveLength(2)

    plans.setGraph(
      buildGraph({
        cookingEvents: [
          buildCookingEvent({
            id: 'event-1',
            planId: 'plan-1',
            ingredientLines: [
              baseIngredientLine('flour', { value: 300, unit: 'g' }),
              baseIngredientLine('flour', { value: 1, unit: 'cup' }),
            ],
            yieldQty: { value: 1, unit: 'serving' },
            outputQuantity: { value: 1, unit: 'serving' },
          }),
        ],
        components: [buildComponent('slot-1', 'event-1')],
      }),
    )

    const preview = await service.previewUpdateFromPlan(generated.list.id)
    expect(preview.ok).toBe(true)
    if (!preview.ok) return
    expect(preview.preview.changed).toHaveLength(1)
    expect(preview.preview.changed[0]?.from).toEqual({ value: 200, unit: 'g' })
    expect(preview.preview.changed[0]?.to).toEqual({ value: 300, unit: 'g' })
    expect(preview.preview.removed).toHaveLength(1)
    expect(preview.preview.removed[0]?.quantity).toEqual({ value: 2, unit: 'piece' })
    expect(preview.preview.added).toHaveLength(1)
    expect(preview.preview.added[0]?.quantity).toEqual({ value: 1, unit: 'cup' })
  })

  it('removes a generated line that the plan no longer requires', async () => {
    const { service, groceries, plans } = makeService(
      buildGraph({
        cookingEvents: [
          buildCookingEvent({
            id: 'event-1',
            planId: 'plan-1',
            ingredientLines: [
              baseIngredientLine('flour', { value: 200, unit: 'g' }),
              baseIngredientLine('spinach', { value: 200, unit: 'g' }),
            ],
            yieldQty: { value: 1, unit: 'serving' },
            outputQuantity: { value: 1, unit: 'serving' },
          }),
        ],
        components: [buildComponent('slot-1', 'event-1')],
      }),
    )
    const generated = await service.generateFromPlan('plan-1')
    expect(generated.ok).toBe(true)
    if (!generated.ok) return
    plans.setGraph(flourGraph({ value: 200, unit: 'g' }))
    const preview = await service.previewUpdateFromPlan(generated.list.id)
    expect(preview.ok).toBe(true)
    if (!preview.ok) return
    expect(preview.preview.removed.map((line) => line.label)).toEqual(['spinach'])
    await service.updateFromPlan(generated.list.id)
    const labels = (await groceries.getItemsForList(generated.list.id)).map((item) => item.label)
    expect(labels).toEqual(['flour'])
  })
})

describe('GroceryService shopping sections', () => {
  it('copies catalog shoppingSection onto generated lines', async () => {
    const ingredients = new Map<IngredientId, Ingredient>([
      [
        'apple',
        {
          id: 'apple',
          name: 'Apple',
          aliases: [],
          shoppingSection: 'produce',
          isCommon: false,
          createdAt: 0,
          updatedAt: 0,
        },
      ],
      [
        'flour',
        {
          id: 'flour',
          name: 'Flour',
          aliases: [],
          shoppingSection: 'pantry',
          isCommon: false,
          createdAt: 0,
          updatedAt: 0,
        },
      ],
      [
        'salt',
        {
          id: 'salt',
          name: 'Salt',
          aliases: [],
          isCommon: true,
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
          ingredientLines: [
            baseIngredientLine('apple', { value: 2, unit: 'piece' }),
            baseIngredientLine('flour', { value: 200, unit: 'g' }),
            baseIngredientLine('salt', { value: 1, unit: 'g' }),
          ],
          yieldQty: { value: 1, unit: 'serving' },
          outputQuantity: { value: 1, unit: 'serving' },
        }),
      ],
      components: [buildComponent('slot-1', 'event-1')],
    })
    const { service, groceries } = makeService(graph, ingredients)

    const result = await service.generateFromPlan('plan-1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const items = await groceries.getItemsForList(result.list.id)
    expect(items.find((item) => item.ingredientId === 'apple')?.shoppingSection).toBe('produce')
    expect(items.find((item) => item.ingredientId === 'flour')?.shoppingSection).toBe('pantry')
    expect(items.find((item) => item.ingredientId === 'salt')?.shoppingSection).toBeUndefined()
  })

  it('stores a section on a manual line', async () => {
    const graph = buildGraph({
      cookingEvents: [],
      components: [],
    })
    const { service } = makeService(graph)
    const created = await service.createEmptyList('Shop')
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const result = await service.addManualItem(created.list.id, 'Paper towels', null, 'pantry')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.item.shoppingSection).toBe('pantry')
    expect(result.item.origin).toBe('manual')
  })
})

describe('GroceryService.generateFromPlan simple-food sources', () => {
  it('records a simple-food allocation as its own source', async () => {
    const foods = new Map<SimpleFoodId, SimpleFood>([
      [
        'yogurt-food',
        {
          id: 'yogurt-food',
          ingredientId: 'yogurt',
          name: 'Yogurt',
          defaultPortion: { value: 1, unit: 'serving' },
          roles: ['breakfast-component'],
          mealTypes: ['breakfast'],
          tagIds: [],
          enabledInSuggestions: true,
          createdAt: 0,
          updatedAt: 0,
        },
      ],
    ])
    const graph = buildGraph({
      cookingEvents: [],
      components: [
        {
          id: 'comp-yogurt',
          slotId: 'slot-1',
          source: { type: 'simple-food', simpleFoodId: 'yogurt-food' },
          allocatedQuantity: { value: 2, unit: 'serving' },
        },
      ],
      slots: [buildSlot('slot-1', false, '2026-01-06', 'breakfast')],
    })
    const { service, groceries } = makeService(graph, new Map(), foods)

    const result = await service.generateFromPlan('plan-1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const items = await groceries.getItemsForList(result.list.id)
    expect(items).toHaveLength(1)
    expect(items[0]?.ingredientId).toBe('yogurt')
    expect(items[0]?.quantity).toEqual({ value: 2, unit: 'serving' })
    expect(items[0]?.sources).toEqual([
      {
        kind: 'simple-food',
        dishName: 'Yogurt',
        quantity: { value: 2, unit: 'serving' },
        meals: [{ slotId: 'slot-1', date: '2026-01-06', mealType: 'breakfast' }],
      },
    ])
  })
})

describe('GroceryService cooking oil and live recipes', () => {
  it('stacks tablespoons of the same ingredient as tablespoons', async () => {
    const graph = buildGraph({
      cookingEvents: [
        buildCookingEvent({
          id: 'event-1',
          planId: 'plan-1',
          ingredientLines: [baseIngredientLine('oil', { value: 2, unit: 'tbsp' })],
          yieldQty: { value: 1, unit: 'serving' },
          outputQuantity: { value: 1, unit: 'serving' },
        }),
        buildCookingEvent({
          id: 'event-2',
          planId: 'plan-1',
          ingredientLines: [baseIngredientLine('oil', { value: 1, unit: 'tbsp' })],
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
    const oil = (await groceries.getItemsForList(result.list.id)).filter(
      (item) => item.ingredientId === 'oil',
    )
    expect(oil).toHaveLength(1)
    expect(oil[0]?.quantity).toEqual({ value: 3, unit: 'tbsp' })
  })

  it('converts mixed spoon and teaspoon oil to milliliters', async () => {
    const graph = buildGraph({
      cookingEvents: [
        buildCookingEvent({
          id: 'event-1',
          planId: 'plan-1',
          ingredientLines: [baseIngredientLine('oil', { value: 1, unit: 'tbsp' })],
          yieldQty: { value: 1, unit: 'serving' },
          outputQuantity: { value: 1, unit: 'serving' },
        }),
        buildCookingEvent({
          id: 'event-2',
          planId: 'plan-1',
          ingredientLines: [baseIngredientLine('oil', { value: 1, unit: 'tsp' })],
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
    const oil = (await groceries.getItemsForList(result.list.id)).find(
      (item) => item.ingredientId === 'oil',
    )
    expect(oil?.quantity?.unit).toBe('ml')
  })

  it('uses the live library recipe amounts instead of the cooking-event snapshot', async () => {
    const graph = buildGraph({
      cookingEvents: [
        buildCookingEvent({
          id: 'event-1',
          planId: 'plan-1',
          ingredientLines: [baseIngredientLine('oil', { value: 1, unit: 'tbsp' })],
          yieldQty: { value: 1, unit: 'serving' },
          outputQuantity: { value: 1, unit: 'serving' },
        }),
      ],
      components: [buildComponent('slot-1', 'event-1')],
    })
    const live = baseRecipe({
      id: 'recipe-1',
      ingredientLines: [baseIngredientLine('oil', { value: 3, unit: 'tbsp' })],
      yield: { value: 1, unit: 'serving' },
    })
    const { service, groceries } = makeService(
      graph,
      new Map(),
      new Map(),
      new Map([['recipe-1', live]]),
    )
    const result = await service.generateFromPlan('plan-1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const oil = (await groceries.getItemsForList(result.list.id)).find(
      (item) => item.ingredientId === 'oil',
    )
    expect(oil?.quantity).toEqual({ value: 3, unit: 'tbsp' })
  })
})
