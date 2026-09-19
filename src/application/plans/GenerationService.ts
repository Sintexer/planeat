import type { Quantity } from '../../domain/shared/Quantity'
import type { CookingEvent } from '../../domain/plans/CookingEvent'
import type { Recipe } from '../../domain/recipes/Recipe'
import { hasPositiveRemaining } from '../../domain/plans/CookingEventAllocation'
import type { MealSlot, MealSlotId } from '../../domain/plans/MealSlot'
import type { MealComponent } from '../../domain/plans/MealComponent'
import type { PlanGraph } from '../../domain/plans/PlanGraph'
import type { PlanRepository } from '../ports/PlanRepository'
import type { RecipeRepository } from '../ports/RecipeRepository'
import type { QuantityService } from '../quantities/QuantityService'
import type { SettingsRepository } from '../ports/SettingsRepository'
import type { SimpleFoodRepository } from '../ports/SimpleFoodRepository'
import type { TagRepository } from '../ports/TagRepository'
import type { IngredientRepository } from '../ports/IngredientRepository'
import type { MealFavoriteRepository } from '../ports/MealFavoriteRepository'
import type { PairingRepository } from '../ports/PairingRepository'
import {
  type GenerationInput,
  type GenerationLeftoverEvent,
  type GenerationMode,
  type WeekGenerationProposal,
  mergeGenerationCompositionBounds,
  mergeGenerationMode,
  mergeGenerationSearchBudget,
  mergeGenerationBatchPolicy,
} from '../../domain/plans/generation/proposal'
import {
  fixedMealsFromPlan,
  mergeGenerationHardPolicy,
} from '../../domain/plans/generation/constraints'
import { runGenerationSearch } from '../../domain/plans/generation/search'
import {
  validateProposalAgainstLive,
  validateSlotForGeneration,
} from '../../domain/plans/generation/proposalValidation'
import { PlanService, type PlanError } from './PlanService'
import type { GenerationSearchRunner } from './generationRunner'
import { addDays } from '../../domain/shared/LocalDate'
import {
  extraProducerDependentSlots,
  lockedDependentSlots,
  producerSlotRequested,
} from '../../domain/plans/generation/replace'
import {
  mergeGenerationSoftPrefs,
  type GenerationSoftPrefs,
} from '../../domain/plans/generation/scoring'
import {
  configFromSettings,
  mergeGenerationConfig,
  type GenerationConfig,
} from '../../domain/plans/generation/GenerationConfig'

export type GenerationError =
  | 'no-eligible-candidates'
  | 'slot-not-empty'
  | 'slot-excluded'
  | 'slot-locked'
  | 'dependents-locked'
  | 'replace-dependents-required'
  | 'stale-proposal'
  | 'cancelled'
  | PlanError

export type GenerationResult<T> = { ok: true; value: T } | { ok: false; error: GenerationError }

export type PrepareGenerationOptions = {
  quantityOverrides?: Readonly<Record<string, Quantity>>
  seed?: string
  mode?: GenerationMode
  config?: GenerationConfig
  presetId?: string
}

export class GenerationService {
  private readonly plans: PlanRepository
  private readonly recipes: RecipeRepository
  private readonly quantities: QuantityService
  private readonly planService: PlanService
  private readonly runner: GenerationSearchRunner
  private readonly settings: SettingsRepository
  private readonly simpleFoods: SimpleFoodRepository
  private readonly tags: TagRepository
  private readonly ingredients: IngredientRepository
  private readonly favorites: MealFavoriteRepository
  private readonly pairings: PairingRepository
  private activeRequestId: string | undefined

  constructor(
    plans: PlanRepository,
    recipes: RecipeRepository,
    quantities: QuantityService,
    planService: PlanService,
    runner: GenerationSearchRunner,
    settings: SettingsRepository,
    simpleFoods: SimpleFoodRepository,
    tags: TagRepository,
    ingredients: IngredientRepository,
    favorites: MealFavoriteRepository,
    pairings: PairingRepository,
  ) {
    this.plans = plans
    this.recipes = recipes
    this.quantities = quantities
    this.planService = planService
    this.runner = runner
    this.settings = settings
    this.simpleFoods = simpleFoods
    this.tags = tags
    this.ingredients = ingredients
    this.favorites = favorites
    this.pairings = pairings
  }

  async inspectReplaceDependents(
    slotIds: readonly MealSlotId[],
  ): Promise<GenerationResult<{ extraSlots: MealSlot[] }>> {
    if (slotIds.length === 0) return { ok: false, error: 'slot-not-found' }
    const first = await this.plans.getSlot(slotIds[0])
    if (!first) return { ok: false, error: 'slot-not-found' }
    const graph = await this.plans.getGraph(first.planId)
    if (!graph) return { ok: false, error: 'not-found' }
    for (const slotId of slotIds) {
      const slot = graph.slots.find((row) => row.id === slotId)
      if (!slot) return { ok: false, error: 'slot-not-found' }
      if (slot.planId !== first.planId) return { ok: false, error: 'not-found' }
      const count = graph.components.filter((row) => row.slotId === slotId).length
      const issue = validateSlotForGeneration(slot, count, 'replace')
      if (issue) return { ok: false, error: issue }
    }
    const extraSlots = extraProducerDependentSlots(graph, slotIds)
    if (lockedDependentSlots(extraSlots).length > 0) {
      return { ok: false, error: 'dependents-locked' }
    }
    return { ok: true, value: { extraSlots } }
  }

  async prepareGeneration(
    slotIds: readonly MealSlotId[],
    options: PrepareGenerationOptions = {},
  ): Promise<GenerationResult<GenerationInput>> {
    if (slotIds.length === 0) return { ok: false, error: 'slot-not-found' }
    const mode = mergeGenerationMode(options.mode)

    const requestedSlots = []
    let planId: string | undefined
    for (const slotId of slotIds) {
      const slot = await this.plans.getSlot(slotId)
      if (!slot) return { ok: false, error: 'slot-not-found' }
      if (planId !== undefined && slot.planId !== planId) return { ok: false, error: 'not-found' }
      planId = slot.planId
      const components = await this.plans.listComponentsForSlot(slotId)
      const slotIssue = validateSlotForGeneration(slot, components.length, mode)
      if (slotIssue) return { ok: false, error: slotIssue }
      requestedSlots.push({ slot, componentCount: components.length })
    }

    if (!planId) return { ok: false, error: 'not-found' }
    if (mode === 'replace') {
      const graph = await this.plans.getGraph(planId)
      if (!graph) return { ok: false, error: 'not-found' }
      const extras = extraProducerDependentSlots(graph, slotIds)
      if (lockedDependentSlots(extras).length > 0) {
        return { ok: false, error: 'dependents-locked' }
      }
      if (extras.length > 0) {
        return { ok: false, error: 'replace-dependents-required' }
      }
    }
    return this.loadSnapshot(
      planId,
      requestedSlots,
      options.seed ?? crypto.randomUUID(),
      options.quantityOverrides,
      mode,
      options.config,
      options.presetId,
    )
  }

  runGeneration(
    input: GenerationInput,
    requestId: string = crypto.randomUUID(),
  ): GenerationResult<WeekGenerationProposal> {
    const proposal = runGenerationSearch(input, requestId, (quantity, factor) =>
      this.quantities.scale(quantity, factor),
    )
    return { ok: true, value: proposal }
  }

  async startGeneration(
    slotIds: readonly MealSlotId[],
    options: PrepareGenerationOptions = {},
  ): Promise<GenerationResult<WeekGenerationProposal>> {
    const prepared = await this.prepareGeneration(slotIds, options)
    if (!prepared.ok) return prepared
    const requestId = crypto.randomUUID()
    this.activeRequestId = requestId
    const result = await this.runner.run(prepared.value, requestId)
    if (this.activeRequestId !== requestId) return { ok: false, error: 'cancelled' }
    return result
  }

  cancel(_proposal?: WeekGenerationProposal): void {
    void _proposal
    this.activeRequestId = undefined
  }

  async applyProposal(
    proposal: WeekGenerationProposal,
  ): Promise<GenerationResult<MealComponent[]>> {
    const slotIds = [
      ...proposal.assignments.map((row) => row.slotId),
      ...proposal.unfilled.map((row) => row.slotId),
    ]
    const live = await this.loadLiveInput(
      slotIds,
      proposal.seed,
      proposal.quantityOverrides,
      mergeGenerationMode(proposal.generationMode),
      proposal.generationConfig,
      proposal.presetId,
    )
    if (!live.ok) return live
    const issue = validateProposalAgainstLive(proposal, live.value)
    if (issue) return { ok: false, error: issue }

    const assignmentItems = proposal.assignments.map((row) => ({
      slotId: row.slotId,
      components: row.components,
    }))
    const result = await this.planService.addGeneratedMealComponents(
      assignmentItems,
      mergeGenerationMode(proposal.generationMode) === 'replace'
        ? { clearSlotIds: proposal.assignments.map((row) => row.slotId) }
        : {},
    )
    if (!result.ok) return result
    return { ok: true, value: result.components }
  }

  private async loadLiveInput(
    slotIds: readonly MealSlotId[],
    seed: string,
    quantityOverrides?: Readonly<Record<string, Quantity>>,
    mode: GenerationMode = 'fill-empty',
    requestConfig?: GenerationConfig,
    presetId?: string,
  ): Promise<GenerationResult<GenerationInput>> {
    if (slotIds.length === 0) return { ok: false, error: 'slot-not-found' }
    const requestedSlots = []
    let planId: string | undefined
    for (const slotId of slotIds) {
      const slot = await this.plans.getSlot(slotId)
      if (!slot) return { ok: false, error: 'slot-not-found' }
      if (planId !== undefined && slot.planId !== planId) return { ok: false, error: 'not-found' }
      planId = slot.planId
      const components = await this.plans.listComponentsForSlot(slotId)
      requestedSlots.push({ slot, componentCount: components.length })
    }
    if (!planId) return { ok: false, error: 'not-found' }
    return this.loadSnapshot(
      planId,
      requestedSlots,
      seed,
      quantityOverrides,
      mode,
      requestConfig,
      presetId,
    )
  }

  private async loadSnapshot(
    planId: string,
    requestedSlots: GenerationInput['requestedSlots'],
    seed: string,
    quantityOverrides?: Readonly<Record<string, Quantity>>,
    mode: GenerationMode = 'fill-empty',
    requestConfig?: GenerationConfig,
    presetId?: string,
  ): Promise<GenerationResult<GenerationInput>> {
    const plan = await this.plans.getById(planId)
    if (!plan) return { ok: false, error: 'not-found' }
    const graph = await this.plans.getGraph(planId)
    if (!graph) return { ok: false, error: 'not-found' }
    const [recipes, settings, simpleFoods, tags, ingredients, favorites, pairings] =
      await Promise.all([
        this.recipes.getAll(),
        this.settings.get(),
        this.simpleFoods.getAll(),
        this.tags.getAll(),
        this.ingredients.getAll(),
        this.favorites.list(),
        this.pairings.list(),
      ])
    const previousStart = addDays(plan.startDate, -7)
    const previous = await this.plans.getByStartDate(previousStart)
    const previousGraph = previous ? await this.plans.getGraph(previous.id) : undefined
    const previousWeekRecipeIds = [
      ...new Set((previousGraph?.cookingEvents ?? []).map((event) => event.recipeId)),
    ]
    const tagNamesById: Record<string, string> = {}
    for (const tag of tags) tagNamesById[tag.id] = tag.name
    const config = mergeGenerationConfig(requestConfig ?? configFromSettings(settings))
    const softPrefs: GenerationSoftPrefs = mergeGenerationSoftPrefs({
      quickMealsOnlyDays: config.quickMealsOnlyDays,
      avoidMultipleDemandingPreps: config.avoidMultipleDemandingPreps,
      favorVegetablesDaily: config.favorVegetablesDaily,
      preferredBatchPrepDays: config.preferredBatchPrepDays,
      maxBatchPrepUnits: config.maxBatchPrepUnits,
      generationPreferredTagIds: config.generationPreferredTagIds,
    })
    const requestedIds = new Set(requestedSlots.map((row) => row.slot.id))
    const labeledSlots = requestedSlots.map((row) => ({
      ...row,
      existingLabels: labelsForSlot(graph, row.slot.id, simpleFoods),
    }))
    return {
      ok: true,
      value: {
        planId: plan.id,
        planRevision: plan.revision,
        peopleCount: plan.peopleCount,
        recipes,
        simpleFoods,
        favorites,
        pairings,
        requestedSlots: labeledSlots,
        quantityOverrides,
        seed,
        policy: mergeGenerationHardPolicy(config.generationHardPolicy),
        fixedMeals: fixedMealsFromPlan({
          slots: graph.slots,
          components: graph.components,
          cookingEvents: graph.cookingEvents,
          recipes,
          simpleFoods,
          omitSlotIds: requestedIds,
        }),
        catalogs: {
          recipeIds: recipes.map((recipe) => recipe.id),
          tagIds: tags.map((tag) => tag.id),
          ingredientIds: ingredients.map((ingredient) => ingredient.id),
        },
        softPrefs,
        previousWeekRecipeIds,
        tagNamesById,
        searchBudget: mergeGenerationSearchBudget(config.generationSearchBudget),
        compositionBounds: mergeGenerationCompositionBounds(config.generationCompositionBounds),
        batchPolicy: mergeGenerationBatchPolicy(config.generationBatchPolicy),
        generationMode: mode,
        presetId,
        generationConfig: requestConfig ? config : undefined,
        cookingEvents: leftoverEventsFromGraph(
          graph,
          recipes,
          plan.peopleCount,
          this.quantities,
          this.planService,
          requestedIds,
          mode,
        ),
      },
    }
  }
}

function leftoverEventsFromGraph(
  graph: PlanGraph,
  recipes: readonly Recipe[],
  peopleCount: number,
  quantities: QuantityService,
  planService: PlanService,
  requestedSlotIds: ReadonlySet<string>,
  mode: GenerationMode,
): GenerationLeftoverEvent[] {
  const liveById = new Map(recipes.map((recipe) => [recipe.id, recipe]))
  const slotsById = new Map(graph.slots.map((slot) => [slot.id, slot]))
  return graph.cookingEvents.flatMap((event) => {
    if (mode === 'replace' && producerSlotRequested(graph, event, requestedSlotIds, slotsById)) {
      return []
    }
    let remaining = planService.remainingForCookingEvent(graph, event.id) ?? {
      value: 0,
      unit: event.outputQuantity.unit,
    }
    if (mode === 'replace') {
      for (const component of graph.components) {
        if (component.source.type !== 'cooking-event') continue
        const source = component.source
        if (source.cookingEventId !== event.id) continue
        if (!requestedSlotIds.has(component.slotId)) continue
        remaining = quantities.add(remaining, component.allocatedQuantity) ?? remaining
      }
    }
    const recipe = liveById.get(event.recipeId) ?? recipeFromSnapshot(event)
    const scaled = quantities.scale(event.recipeSnapshot.defaultPortionPerPerson, peopleCount)
    const desiredQuantity =
      scaled && hasPositiveRemaining(remaining)
        ? (quantities.convert(scaled, remaining.unit) ?? undefined)
        : undefined
    return [
      {
        id: event.id,
        recipeId: event.recipeId,
        recipeName: event.recipeSnapshot.name,
        scheduledDate: event.scheduledDate,
        outputQuantity: event.outputQuantity,
        remaining,
        desiredQuantity: desiredQuantity ?? undefined,
        reusePolicy: event.recipeSnapshot.reusePolicy,
        mealTypes: event.recipeSnapshot.mealTypes,
        recipe,
        role: event.recipeSnapshot.roles[0],
      },
    ]
  })
}

function labelsForSlot(
  graph: PlanGraph,
  slotId: string,
  foods: readonly { id: string; name: string }[],
): string[] {
  const foodNames = new Map(foods.map((food) => [food.id, food.name]))
  const names: string[] = []
  for (const component of graph.components) {
    if (component.slotId !== slotId) continue
    const source = component.source
    if (source.type === 'cooking-event') {
      const event = graph.cookingEvents.find((row) => row.id === source.cookingEventId)
      names.push(event?.recipeSnapshot.name ?? 'Preparation')
    } else {
      names.push(foodNames.get(source.simpleFoodId) ?? source.simpleFoodId)
    }
  }
  return names
}

function recipeFromSnapshot(event: CookingEvent): Recipe {
  const { tags, ...rest } = event.recipeSnapshot
  void tags
  return { ...rest, tagIds: [] }
}
