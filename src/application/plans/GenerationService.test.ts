import { describe, expect, it } from 'vitest'
import { GenerationService } from './GenerationService'
import { createSyncGenerationRunner, type GenerationSearchRunner } from './generationRunner'
import { PlanService } from './PlanService'
import { QuantityService } from '../quantities/QuantityService'
import type { AddCookingEventComponentInput, PlanRepository } from '../ports/PlanRepository'
import type { RecipeRepository } from '../ports/RecipeRepository'
import type { SettingsRepository } from '../ports/SettingsRepository'
import type { SimpleFoodRepository } from '../ports/SimpleFoodRepository'
import type { TagRepository } from '../ports/TagRepository'
import type { IngredientRepository } from '../ports/IngredientRepository'
import type { CookingEvent } from '../../domain/plans/CookingEvent'
import type { MealComponent } from '../../domain/plans/MealComponent'
import type { MealSlot } from '../../domain/plans/MealSlot'
import type { Plan, PlanId } from '../../domain/plans/Plan'
import type { PlanGraph } from '../../domain/plans/PlanGraph'
import type { Recipe } from '../../domain/recipes/Recipe'
import type { Tag } from '../../domain/tags/Tag'
import { DEFAULT_SETTINGS, type Settings } from '../../domain/shared/Settings'
import type { WeekGenerationProposal } from '../../domain/plans/generation/proposal'

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
  previous?: PlanGraph
  addCalls: AddCookingEventComponentInput[] = []
  batchCalls: AddCookingEventComponentInput[][] = []

  constructor(graph: PlanGraph, previous?: PlanGraph) {
    this.graph = graph
    this.previous = previous
  }

  async getById(id: PlanId) {
    if (this.graph.plan.id === id) return this.graph.plan
    if (this.previous?.plan.id === id) return this.previous.plan
    return undefined
  }

  async getSlot(slotId: string) {
    return this.graph.slots.find((row) => row.id === slotId)
  }

  async listComponentsForSlot(slotId: string) {
    return this.graph.components.filter((row) => row.slotId === slotId)
  }

  async getGraph(id: PlanId) {
    if (this.graph.plan.id === id) return this.graph
    if (this.previous?.plan.id === id) return this.previous
    return undefined
  }

  async addCookingEventComponent(planId: PlanId, input: AddCookingEventComponentInput) {
    const [component] = await this.addCookingEventComponents(planId, [input])
    return component
  }

  async addCookingEventComponents(planId: PlanId, inputs: AddCookingEventComponentInput[]) {
    this.batchCalls.push(inputs)
    const components: MealComponent[] = []
    for (const input of inputs) {
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
        cookingEvents: [...this.graph.cookingEvents, event],
        components: [...this.graph.components, component],
      }
      components.push(component)
    }
    this.graph = {
      ...this.graph,
      plan: { ...this.graph.plan, revision: this.graph.plan.revision + 1 },
    }
    return components
  }

  getByStartDate: PlanRepository['getByStartDate'] = async (startDate) => {
    if (this.graph.plan.startDate === startDate) return this.graph.plan
    if (this.previous?.plan.startDate === startDate) return this.previous.plan
    return undefined
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

  async getAll() {
    return [...this.tags]
  }

  async getByIds(ids: string[]) {
    return this.tags.filter((tag) => ids.includes(tag.id))
  }

  create: TagRepository['create'] = () => {
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
    getAll: async () => [],
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

function unusedSettings(settings: Settings = DEFAULT_SETTINGS): SettingsRepository {
  return {
    get: async () => settings,
    update: async () => undefined,
  }
}

function unusedIngredients(): IngredientRepository {
  return {
    create: () => {
      throw new Error('not implemented')
    },
    getAll: async () => [],
    getById: () => {
      throw new Error('not implemented')
    },
    findByNameOrAlias: () => {
      throw new Error('not implemented')
    },
    findCandidatesByName: () => {
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

function makeGraph(
  overrides: {
    slots?: MealSlot[]
    plan?: Plan
    components?: MealComponent[]
    cookingEvents?: CookingEvent[]
  } = {},
): PlanGraph {
  const plan = overrides.plan ?? emptyPlan()
  const slots = overrides.slots ?? [emptySlot({ planId: plan.id })]
  return {
    plan,
    slots,
    components: overrides.components ?? [],
    cookingEvents: overrides.cookingEvents ?? [],
    prepSessions: [],
  }
}

function makeServices(
  graph: PlanGraph,
  recipes: Recipe[],
  runner?: GenerationSearchRunner,
  settings: Settings = DEFAULT_SETTINGS,
  previous?: PlanGraph,
) {
  const plans = new FakePlanRepository(graph, previous)
  const recipeRepo = new FakeRecipeRepository(recipes)
  const quantities = new QuantityService()
  const tags = new FakeTagRepository()
  const planService = new PlanService(
    plans,
    recipeRepo,
    unusedSimpleFoods(),
    unusedSettings(),
    quantities,
    tags,
  )
  const generation = new GenerationService(
    plans,
    recipeRepo,
    quantities,
    planService,
    runner ?? createSyncGenerationRunner(quantities),
    unusedSettings(settings),
    unusedSimpleFoods(),
    tags,
    unusedIngredients(),
  )
  return { plans, recipeRepo, generation, quantities }
}

describe('GenerationService', () => {
  it('scales the first eligible complete recipe like cook-new', async () => {
    const soup = baseRecipe()
    const { generation, quantities } = makeServices(makeGraph(), [soup])
    const prepared = await generation.prepareGeneration(['slot-dinner'], { seed: 'seed-1' })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const ran = generation.runGeneration(prepared.value, 'req-1')
    expect(ran.ok).toBe(true)
    if (!ran.ok) return
    expect(ran.value.assignments[0].recipeId).toBe('recipe-soup')
    expect(ran.value.assignments[0].outputQuantity).toEqual(
      quantities.scale(soup.defaultPortionPerPerson, 3),
    )
  })

  it('apply writes assigned slots in one batch and freezes tag labels', async () => {
    const lunch = emptySlot({ id: 'slot-lunch', mealType: 'lunch', date: '2026-01-05' })
    const dinner = emptySlot()
    const { generation, plans } = makeServices(makeGraph({ slots: [lunch, dinner] }), [
      baseRecipe(),
      baseRecipe({ id: 'oats', name: 'Oats', mealTypes: ['lunch'] }),
    ])
    const started = await generation.startGeneration(['slot-lunch', 'slot-dinner'], {
      seed: 'seed-1',
    })
    if (!started.ok) throw new Error(started.error)
    const existing = plans.graph.components.length
    const applied = await generation.applyProposal(started.value)
    expect(applied.ok).toBe(true)
    expect(plans.batchCalls).toHaveLength(1)
    expect(plans.batchCalls[0]).toHaveLength(2)
    expect(plans.addCalls[0].recipeSnapshot.tags).toEqual(['Comfort'])
    expect('tagIds' in plans.addCalls[0].recipeSnapshot).toBe(false)
    expect(plans.graph.components.length).toBe(existing + 2)
    expect(plans.graph.plan.revision).toBe(2)
  })

  it('apply does not touch unfilled or already planned slots', async () => {
    const planned = emptySlot({ id: 'slot-planned', date: '2026-01-05' })
    const lunch = emptySlot({ id: 'slot-lunch', mealType: 'lunch' })
    const dinner = emptySlot()
    const plannedComponent: MealComponent = {
      id: 'c-planned',
      slotId: 'slot-planned',
      source: { type: 'cooking-event', cookingEventId: 'e-planned' },
      allocatedQuantity: { value: 1, unit: 'serving' },
    }
    const { generation, plans } = makeServices(
      makeGraph({ slots: [planned, lunch, dinner], components: [plannedComponent] }),
      [baseRecipe()],
    )
    const started = await generation.startGeneration(['slot-lunch', 'slot-dinner'], {
      seed: 'seed-1',
    })
    if (!started.ok) throw new Error(started.error)
    expect(started.value.unfilled).toEqual([
      { slotId: 'slot-lunch', reason: 'no-eligible-candidates', mealType: 'lunch' },
    ])
    const applied = await generation.applyProposal(started.value)
    expect(applied.ok).toBe(true)
    expect(plans.batchCalls[0].map((row) => row.slotId)).toEqual(['slot-dinner'])
    expect(plans.graph.components.some((row) => row.id === 'c-planned')).toBe(true)
  })

  it('cancel before a late runner result writes nothing', async () => {
    let finish: ((proposal: WeekGenerationProposal) => void) | undefined
    let entered: (() => void) | undefined
    const delayed: GenerationSearchRunner = {
      run: () => {
        entered?.()
        return new Promise((resolve) => {
          finish = (proposal) => resolve({ ok: true, value: proposal })
        })
      },
    }
    const { generation, plans } = makeServices(makeGraph(), [baseRecipe()], delayed)
    const prepared = await generation.prepareGeneration(['slot-dinner'], { seed: 'seed-1' })
    if (!prepared.ok) throw new Error(prepared.error)
    const sync = generation.runGeneration(prepared.value, 'req-1')
    if (!sync.ok) throw new Error(sync.error)
    const enteredRun = new Promise<void>((resolve) => {
      entered = resolve
    })
    const pending = generation.startGeneration(['slot-dinner'], { seed: 'seed-1' })
    await enteredRun
    generation.cancel()
    finish?.(sync.value)
    expect(await pending).toEqual({ ok: false, error: 'cancelled' })
    expect(plans.batchCalls).toHaveLength(0)
  })

  it('ignores a superseded request id', async () => {
    const resolvers: Array<(proposal: WeekGenerationProposal) => void> = []
    let enteredCount = 0
    let notifyEntered: (() => void) | undefined
    const delayed: GenerationSearchRunner = {
      run: () => {
        enteredCount += 1
        notifyEntered?.()
        return new Promise((resolve) => {
          resolvers.push((proposal) => resolve({ ok: true, value: proposal }))
        })
      },
    }
    const { generation, plans } = makeServices(makeGraph(), [baseRecipe()], delayed)
    const prepared = await generation.prepareGeneration(['slot-dinner'], { seed: 'seed-1' })
    if (!prepared.ok) throw new Error(prepared.error)
    const sync = generation.runGeneration(prepared.value, 'req-1')
    if (!sync.ok) throw new Error(sync.error)
    const firstEntered = new Promise<void>((resolve) => {
      notifyEntered = resolve
    })
    const first = generation.startGeneration(['slot-dinner'], { seed: 'seed-1' })
    await firstEntered
    const secondEntered = new Promise<void>((resolve) => {
      notifyEntered = resolve
    })
    const second = generation.startGeneration(['slot-dinner'], { seed: 'seed-1' })
    await secondEntered
    resolvers[0]?.(sync.value)
    resolvers[1]?.(sync.value)
    expect(await first).toEqual({ ok: false, error: 'cancelled' })
    const later = await second
    expect(later.ok).toBe(true)
    if (!later.ok) return
    await generation.applyProposal(later.value)
    expect(plans.batchCalls).toHaveLength(1)
    expect(enteredCount).toBe(2)
  })

  it('rejects filled and excluded slots on prepare', async () => {
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
    expect(await filled.generation.prepareGeneration(['slot-dinner'])).toEqual({
      ok: false,
      error: 'slot-not-empty',
    })

    const excluded = makeServices(makeGraph({ slots: [emptySlot({ excluded: true })] }), [
      baseRecipe(),
    ])
    expect(await excluded.generation.prepareGeneration(['slot-dinner'])).toEqual({
      ok: false,
      error: 'slot-excluded',
    })
  })

  it('returns an empty proposal with diagnostics when nothing matches', async () => {
    const { generation } = makeServices(makeGraph(), [
      baseRecipe({ roles: ['main'] }),
      baseRecipe({ id: 'lunch-only', mealTypes: ['lunch'] }),
    ])
    const started = await generation.startGeneration(['slot-dinner'], { seed: 'seed-1' })
    expect(started.ok).toBe(true)
    if (!started.ok) return
    expect(started.value.assignments).toEqual([])
    expect(started.value.unfilled).toEqual([
      { slotId: 'slot-dinner', reason: 'no-eligible-candidates', mealType: 'dinner' },
    ])
    expect(started.value.diagnostics.dropCounts.some((row) => row.reason === 'not-complete')).toBe(
      true,
    )
  })

  it('loads household hard policy and lists a fixed conflicting meal', async () => {
    const peanut = baseRecipe({
      id: 'peanut-stew',
      name: 'Peanut stew',
      ingredientLines: [{ displayText: 'peanut', ingredientId: 'peanut', quantity: null }],
    })
    const rice = baseRecipe({
      id: 'rice',
      name: 'Rice',
      ingredientLines: [{ displayText: 'rice', ingredientId: 'rice', quantity: null }],
    })
    const planned = emptySlot({ id: 'slot-planned', date: '2026-01-05' })
    const dinner = emptySlot()
    const event: CookingEvent = {
      id: 'e-planned',
      planId: 'plan-1',
      sessionId: 'session-1',
      recipeId: peanut.id,
      recipeSnapshot: { ...peanut, tags: ['Comfort'] },
      outputQuantity: { value: 3, unit: 'serving' },
      scheduledDate: '2026-01-05',
    }
    const { generation } = makeServices(
      makeGraph({
        slots: [planned, dinner],
        components: [
          {
            id: 'c-planned',
            slotId: 'slot-planned',
            source: { type: 'cooking-event', cookingEventId: 'e-planned' },
            allocatedQuantity: { value: 1, unit: 'serving' },
          },
        ],
        cookingEvents: [event],
      }),
      [peanut, rice],
      undefined,
      {
        ...DEFAULT_SETTINGS,
        generationHardPolicy: {
          ...DEFAULT_SETTINGS.generationHardPolicy,
          excludeIngredientIds: ['peanut'],
        },
      },
    )
    const prepared = await generation.prepareGeneration(['slot-dinner'], { seed: 'seed-1' })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect([...prepared.value.policy.excludeIngredientIds]).toEqual(['peanut'])
    const started = await generation.startGeneration(['slot-dinner'], { seed: 'seed-1' })
    expect(started.ok).toBe(true)
    if (!started.ok) return
    expect(started.value.assignments[0].recipeId).toBe('rice')
    expect(started.value.diagnostics.fixedConflicts).toEqual([
      {
        slotId: 'slot-planned',
        date: '2026-01-05',
        mealType: 'dinner',
        reasons: ['exclude-ingredients'],
      },
    ])
  })

  it('loads previous-week recipe ids as planned history', async () => {
    const soup = baseRecipe()
    const previous = makeGraph({
      plan: emptyPlan({ id: 'plan-prev', startDate: '2025-12-29' }),
      cookingEvents: [
        {
          id: 'e-old',
          planId: 'plan-prev',
          sessionId: 'session-old',
          recipeId: soup.id,
          recipeSnapshot: { ...soup, tags: ['Comfort'] },
          outputQuantity: { value: 3, unit: 'serving' },
          scheduledDate: '2025-12-29',
        },
      ],
    })
    const { generation } = makeServices(makeGraph(), [soup], undefined, DEFAULT_SETTINGS, previous)
    const prepared = await generation.prepareGeneration(['slot-dinner'], { seed: 'seed-1' })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.value.previousWeekRecipeIds).toEqual(['recipe-soup'])
    expect(prepared.value.softPrefs.maxBatchPrepUnits).toBe(DEFAULT_SETTINGS.maxBatchPrepUnits)
    expect(prepared.value.searchBudget).toEqual(DEFAULT_SETTINGS.generationSearchBudget)
  })

  it('rejects a stale fingerprint and leaves the plan unchanged', async () => {
    const soup = baseRecipe()
    const { generation, plans, recipeRepo } = makeServices(makeGraph(), [soup])
    const started = await generation.startGeneration(['slot-dinner'], { seed: 'seed-1' })
    if (!started.ok) throw new Error(started.error)
    recipeRepo.setRows([{ ...soup, name: 'Renamed soup', updatedAt: 99 }])
    const applied = await generation.applyProposal(started.value)
    expect(applied).toEqual({ ok: false, error: 'stale-proposal' })
    expect(plans.batchCalls).toHaveLength(0)
    expect(plans.graph.plan.revision).toBe(1)
  })

  it('does not construct or call a grocery service', () => {
    const { generation } = makeServices(makeGraph(), [baseRecipe()])
    expect(generation).toBeInstanceOf(GenerationService)
  })
})
