import { describe, expect, it } from 'vitest'
import { GenerationService } from './GenerationService'
import { PlanService } from './PlanService'
import { QuantityService } from '../quantities/QuantityService'
import type { AddCookingEventComponentInput, PlanRepository } from '../ports/PlanRepository'
import type { RecipeRepository } from '../ports/RecipeRepository'
import type { SettingsRepository } from '../ports/SettingsRepository'
import type { SimpleFoodRepository } from '../ports/SimpleFoodRepository'
import type { TagRepository } from '../ports/TagRepository'
import type { CookingEvent } from '../../domain/plans/CookingEvent'
import type { MealComponent } from '../../domain/plans/MealComponent'
import type { MealSlot } from '../../domain/plans/MealSlot'
import type { Plan, PlanId } from '../../domain/plans/Plan'
import type { PlanGraph } from '../../domain/plans/PlanGraph'
import type { Recipe } from '../../domain/recipes/Recipe'
import type { Tag } from '../../domain/tags/Tag'

function baseRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'recipe-soup',
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
    tagIds: ['tag-1'],
    createdAt: 0,
    updatedAt: 10,
    ...overrides,
  }
}

function emptySlot(overrides: Partial<MealSlot> = {}): MealSlot {
  return {
    id: 'slot-dinner',
    planId: 'plan-1',
    date: '2026-01-06',
    mealType: 'dinner',
    excluded: false,
    ...overrides,
  }
}

function emptyPlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-1',
    startDate: '2026-01-05',
    dayCount: 7,
    peopleCount: 3,
    revision: 1,
    preferences: {},
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

class FakePlanRepository implements PlanRepository {
  graph: PlanGraph
  addCalls: AddCookingEventComponentInput[] = []

  constructor(graph: PlanGraph) {
    this.graph = graph
  }

  async getById(id: PlanId) {
    return this.graph.plan.id === id ? this.graph.plan : undefined
  }

  async getSlot(slotId: string) {
    return this.graph.slots.find((row) => row.id === slotId)
  }

  async listComponentsForSlot(slotId: string) {
    return this.graph.components.filter((row) => row.slotId === slotId)
  }

  async getGraph(id: PlanId) {
    return this.graph.plan.id === id ? this.graph : undefined
  }

  async addCookingEventComponent(planId: PlanId, input: AddCookingEventComponentInput) {
    this.addCalls.push(input)
    const event: CookingEvent = {
      id: `event-${this.addCalls.length}`,
      planId,
      sessionId: 'session-1',
      recipeId: input.recipeId,
      recipeSnapshot: input.recipeSnapshot,
      outputQuantity: input.outputQuantity,
      scheduledDate: input.scheduledDate,
    }
    const component: MealComponent = {
      id: `component-${this.addCalls.length}`,
      slotId: input.slotId,
      source: { type: 'cooking-event', cookingEventId: event.id },
      allocatedQuantity: input.allocatedQuantity,
      role: input.role,
    }
    this.graph = {
      ...this.graph,
      plan: { ...this.graph.plan, revision: this.graph.plan.revision + 1 },
      cookingEvents: [...this.graph.cookingEvents, event],
      components: [...this.graph.components, component],
    }
    return component
  }

  getByStartDate: PlanRepository['getByStartDate'] = () => {
    throw new Error('not implemented')
  }
  createPlanWithSlots: PlanRepository['createPlanWithSlots'] = () => {
    throw new Error('not implemented')
  }
  setSlotExcluded: PlanRepository['setSlotExcluded'] = () => {
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
  getCookingEvent: PlanRepository['getCookingEvent'] = () => {
    throw new Error('not implemented')
  }
}

class FakeRecipeRepository implements RecipeRepository {
  private rows: Recipe[]

  constructor(rows: Recipe[]) {
    this.rows = rows
  }

  async getAll() {
    return [...this.rows]
  }

  async getById(id: string) {
    return this.rows.find((row) => row.id === id)
  }

  setRows(rows: Recipe[]) {
    this.rows = rows
  }

  create: RecipeRepository['create'] = () => {
    throw new Error('not implemented')
  }
  update: RecipeRepository['update'] = () => {
    throw new Error('not implemented')
  }
  remove: RecipeRepository['remove'] = () => {
    throw new Error('not implemented')
  }
}

class FakeTagRepository implements TagRepository {
  private readonly tags: Tag[]

  constructor(tags: Tag[] = [{ id: 'tag-1', name: 'Comfort', createdAt: 0, updatedAt: 0 }]) {
    this.tags = tags
  }

  async getByIds(ids: string[]) {
    return this.tags.filter((tag) => ids.includes(tag.id))
  }

  create: TagRepository['create'] = () => {
    throw new Error('not implemented')
  }
  getAll: TagRepository['getAll'] = () => {
    throw new Error('not implemented')
  }
  getById: TagRepository['getById'] = () => {
    throw new Error('not implemented')
  }
  findByName: TagRepository['findByName'] = () => {
    throw new Error('not implemented')
  }
  update: TagRepository['update'] = () => {
    throw new Error('not implemented')
  }
  countLiveAssignments: TagRepository['countLiveAssignments'] = () => {
    throw new Error('not implemented')
  }
  mergeLiveAssignments: TagRepository['mergeLiveAssignments'] = () => {
    throw new Error('not implemented')
  }
  deleteTagAndUnassign: TagRepository['deleteTagAndUnassign'] = () => {
    throw new Error('not implemented')
  }
  applyLiveTagChanges: TagRepository['applyLiveTagChanges'] = () => {
    throw new Error('not implemented')
  }
}

function unusedSimpleFoods(): SimpleFoodRepository {
  return {
    create: () => {
      throw new Error('not implemented')
    },
    getAll: () => {
      throw new Error('not implemented')
    },
    getById: () => {
      throw new Error('not implemented')
    },
    update: () => {
      throw new Error('not implemented')
    },
    remove: () => {
      throw new Error('not implemented')
    },
  }
}

function unusedSettings(): SettingsRepository {
  return {
    get: () => {
      throw new Error('not implemented')
    },
    update: () => {
      throw new Error('not implemented')
    },
  }
}

function makeGraph(
  overrides: { slot?: MealSlot; plan?: Plan; components?: MealComponent[] } = {},
): PlanGraph {
  const plan = overrides.plan ?? emptyPlan()
  const mealSlot = overrides.slot ?? emptySlot({ planId: plan.id })
  return {
    plan,
    slots: [mealSlot],
    components: overrides.components ?? [],
    cookingEvents: [],
    prepSessions: [],
  }
}

function makeServices(graph: PlanGraph, recipes: Recipe[]) {
  const plans = new FakePlanRepository(graph)
  const recipeRepo = new FakeRecipeRepository(recipes)
  const quantities = new QuantityService()
  const planService = new PlanService(
    plans,
    recipeRepo,
    unusedSimpleFoods(),
    unusedSettings(),
    quantities,
    new FakeTagRepository(),
  )
  const generation = new GenerationService(plans, recipeRepo, quantities, planService)
  return { plans, recipeRepo, generation, quantities }
}

describe('GenerationService', () => {
  it('scales the first eligible complete recipe like cook-new', async () => {
    const soup = baseRecipe()
    const { generation, quantities } = makeServices(makeGraph(), [soup])
    const prepared = await generation.prepareGeneration('slot-dinner')
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const ran = generation.runGeneration(prepared.value, 'req-1')
    expect(ran.ok).toBe(true)
    if (!ran.ok) return
    expect(ran.value.recipeId).toBe('recipe-soup')
    expect(ran.value.outputQuantity).toEqual(quantities.scale(soup.defaultPortionPerPerson, 3))
    expect(ran.value.allocatedQuantity).toEqual(ran.value.outputQuantity)
  })

  it('apply writes a cooking event with frozen tag labels', async () => {
    const { generation, plans } = makeServices(makeGraph(), [baseRecipe()])
    const prepared = await generation.prepareGeneration('slot-dinner')
    if (!prepared.ok) throw new Error(prepared.error)
    const ran = generation.runGeneration(prepared.value)
    if (!ran.ok) throw new Error(ran.error)
    const applied = await generation.applyProposal(ran.value)
    expect(applied.ok).toBe(true)
    expect(plans.addCalls).toHaveLength(1)
    expect(plans.addCalls[0].recipeSnapshot.tags).toEqual(['Comfort'])
    expect('tagIds' in plans.addCalls[0].recipeSnapshot).toBe(false)
    expect(plans.graph.components).toHaveLength(1)
  })

  it('cancel and preview do not write', async () => {
    const { generation, plans } = makeServices(makeGraph(), [baseRecipe()])
    const prepared = await generation.prepareGeneration('slot-dinner')
    if (!prepared.ok) throw new Error(prepared.error)
    const ran = generation.runGeneration(prepared.value)
    if (!ran.ok) throw new Error(ran.error)
    generation.cancel(ran.value)
    expect(plans.addCalls).toHaveLength(0)
    expect(plans.graph.components).toHaveLength(0)
  })

  it('rejects filled and excluded slots', async () => {
    const filled = makeServices(
      makeGraph({
        components: [
          {
            id: 'c1',
            slotId: 'slot-dinner',
            source: { type: 'cooking-event', cookingEventId: 'e1' },
            allocatedQuantity: { value: 1, unit: 'serving' },
          },
        ],
      }),
      [baseRecipe()],
    )
    const filledResult = await filled.generation.prepareGeneration('slot-dinner')
    expect(filledResult).toEqual({ ok: false, error: 'slot-not-empty' })

    const excluded = makeServices(makeGraph({ slot: emptySlot({ excluded: true }) }), [
      baseRecipe(),
    ])
    const excludedResult = await excluded.generation.prepareGeneration('slot-dinner')
    expect(excludedResult).toEqual({ ok: false, error: 'slot-excluded' })
  })

  it('returns no-eligible-candidates when nothing matches the occasion', async () => {
    const { generation } = makeServices(makeGraph(), [
      baseRecipe({ roles: ['main'] }),
      baseRecipe({ id: 'lunch-only', mealTypes: ['lunch'] }),
    ])
    const prepared = await generation.prepareGeneration('slot-dinner')
    if (!prepared.ok) throw new Error(prepared.error)
    const ran = generation.runGeneration(prepared.value)
    expect(ran).toEqual({ ok: false, error: 'no-eligible-candidates' })
  })

  it('rejects a stale fingerprint and leaves the plan unchanged', async () => {
    const soup = baseRecipe()
    const { generation, plans, recipeRepo } = makeServices(makeGraph(), [soup])
    const prepared = await generation.prepareGeneration('slot-dinner')
    if (!prepared.ok) throw new Error(prepared.error)
    const ran = generation.runGeneration(prepared.value)
    if (!ran.ok) throw new Error(ran.error)
    recipeRepo.setRows([{ ...soup, name: 'Renamed soup', updatedAt: 99 }])
    const applied = await generation.applyProposal(ran.value)
    expect(applied).toEqual({ ok: false, error: 'stale-proposal' })
    expect(plans.addCalls).toHaveLength(0)
    expect(plans.graph.plan.revision).toBe(1)
  })

  it('does not construct or call a grocery service', () => {
    const { generation } = makeServices(makeGraph(), [baseRecipe()])
    expect(generation).toBeInstanceOf(GenerationService)
  })
})
