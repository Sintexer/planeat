import type { Quantity } from '../../domain/shared/Quantity'
import type { CookingEvent } from '../../domain/plans/CookingEvent'
import type { Recipe } from '../../domain/recipes/Recipe'
import { hasPositiveRemaining } from '../../domain/plans/CookingEventAllocation'
import type { MealSlotId } from '../../domain/plans/MealSlot'
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
  type WeekGenerationProposal,
  mergeGenerationCompositionBounds,
  mergeGenerationSearchBudget,
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
  mergeGenerationSoftPrefs,
  type GenerationSoftPrefs,
} from '../../domain/plans/generation/scoring'

export type GenerationError =
  | 'no-eligible-candidates'
  | 'slot-not-empty'
  | 'slot-excluded'
  | 'stale-proposal'
  | 'cancelled'
  | PlanError

export type GenerationResult<T> = { ok: true; value: T } | { ok: false; error: GenerationError }

export type PrepareGenerationOptions = {
  quantityOverrides?: Readonly<Record<string, Quantity>>
  seed?: string
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

  async prepareGeneration(
    slotIds: readonly MealSlotId[],
    options: PrepareGenerationOptions = {},
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
      const slotIssue = validateSlotForGeneration(slot, components.length)
      if (slotIssue) return { ok: false, error: slotIssue }
      requestedSlots.push({ slot, componentCount: components.length })
    }

    if (!planId) return { ok: false, error: 'not-found' }
    return this.loadSnapshot(
      planId,
      requestedSlots,
      options.seed ?? crypto.randomUUID(),
      options.quantityOverrides,
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
    const live = await this.loadLiveInput(slotIds, proposal.seed, proposal.quantityOverrides)
    if (!live.ok) return live
    const issue = validateProposalAgainstLive(proposal, live.value)
    if (issue) return { ok: false, error: issue }

    const result = await this.planService.addGeneratedMealComponents(
      proposal.assignments.map((row) => ({
        slotId: row.slotId,
        components: row.components,
      })),
    )
    if (!result.ok) return result
    return { ok: true, value: result.components }
  }

  private async loadLiveInput(
    slotIds: readonly MealSlotId[],
    seed: string,
    quantityOverrides?: Readonly<Record<string, Quantity>>,
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
    return this.loadSnapshot(planId, requestedSlots, seed, quantityOverrides)
  }

  private async loadSnapshot(
    planId: string,
    requestedSlots: GenerationInput['requestedSlots'],
    seed: string,
    quantityOverrides?: Readonly<Record<string, Quantity>>,
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
    const softPrefs: GenerationSoftPrefs = mergeGenerationSoftPrefs({
      quickMealsOnlyDays: settings.quickMealsOnlyDays,
      avoidMultipleDemandingPreps: settings.avoidMultipleDemandingPreps,
      favorVegetablesDaily: settings.favorVegetablesDaily,
      preferredBatchPrepDays: settings.preferredBatchPrepDays,
      maxBatchPrepUnits: settings.maxBatchPrepUnits,
      generationPreferredTagIds: settings.generationPreferredTagIds,
    })
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
        requestedSlots,
        quantityOverrides,
        seed,
        policy: mergeGenerationHardPolicy(settings.generationHardPolicy),
        fixedMeals: fixedMealsFromPlan({
          slots: graph.slots,
          components: graph.components,
          cookingEvents: graph.cookingEvents,
          recipes,
          simpleFoods,
        }),
        catalogs: {
          recipeIds: recipes.map((recipe) => recipe.id),
          tagIds: tags.map((tag) => tag.id),
          ingredientIds: ingredients.map((ingredient) => ingredient.id),
        },
        softPrefs,
        previousWeekRecipeIds,
        tagNamesById,
        searchBudget: mergeGenerationSearchBudget(settings.generationSearchBudget),
        compositionBounds: mergeGenerationCompositionBounds(settings.generationCompositionBounds),
        cookingEvents: leftoverEventsFromGraph(
          graph,
          recipes,
          plan.peopleCount,
          this.quantities,
          this.planService,
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
): GenerationLeftoverEvent[] {
  const liveById = new Map(recipes.map((recipe) => [recipe.id, recipe]))
  return graph.cookingEvents.map((event) => {
    const remaining = planService.remainingForCookingEvent(graph, event.id) ?? {
      value: 0,
      unit: event.outputQuantity.unit,
    }
    const recipe = liveById.get(event.recipeId) ?? recipeFromSnapshot(event)
    const scaled = quantities.scale(event.recipeSnapshot.defaultPortionPerPerson, peopleCount)
    const desiredQuantity =
      scaled && hasPositiveRemaining(remaining)
        ? (quantities.convert(scaled, remaining.unit) ?? undefined)
        : undefined
    return {
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
    }
  })
}

function recipeFromSnapshot(event: CookingEvent): Recipe {
  const { tags, ...rest } = event.recipeSnapshot
  void tags
  return { ...rest, tagIds: [] }
}
