import type { Quantity } from '../../domain/shared/Quantity'
import type { MealSlotId } from '../../domain/plans/MealSlot'
import type { MealComponent } from '../../domain/plans/MealComponent'
import type { PlanRepository } from '../ports/PlanRepository'
import type { RecipeRepository } from '../ports/RecipeRepository'
import type { QuantityService } from '../quantities/QuantityService'
import {
  type GenerationInput,
  type WeekGenerationProposal,
} from '../../domain/plans/generation/proposal'
import { runGenerationSearch } from '../../domain/plans/generation/search'
import {
  validateProposalAgainstLive,
  validateSlotForGeneration,
} from '../../domain/plans/generation/proposalValidation'
import { PlanService, type PlanError } from './PlanService'
import type { GenerationSearchRunner } from './generationRunner'

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
  private activeRequestId: string | undefined

  constructor(
    plans: PlanRepository,
    recipes: RecipeRepository,
    quantities: QuantityService,
    planService: PlanService,
    runner: GenerationSearchRunner,
  ) {
    this.plans = plans
    this.recipes = recipes
    this.quantities = quantities
    this.planService = planService
    this.runner = runner
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
    const plan = await this.plans.getById(planId)
    if (!plan) return { ok: false, error: 'not-found' }
    const recipes = await this.recipes.getAll()
    return {
      ok: true,
      value: {
        planId: plan.id,
        planRevision: plan.revision,
        peopleCount: plan.peopleCount,
        recipes,
        requestedSlots,
        quantityOverrides: options.quantityOverrides,
        seed: options.seed ?? crypto.randomUUID(),
      },
    }
  }

  runGeneration(
    input: GenerationInput,
    requestId: string = crypto.randomUUID(),
  ): GenerationResult<WeekGenerationProposal> {
    const proposal = runGenerationSearch(input, requestId, (quantity, factor) =>
      this.quantities.scale(quantity, factor),
    )
    if (proposal.assignments.length === 0) {
      return { ok: false, error: 'no-eligible-candidates' }
    }
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

    const result = await this.planService.addNewCookingEventComponents(
      proposal.assignments.map((row) => ({
        slotId: row.slotId,
        recipeId: row.recipeId,
        outputQuantity: row.outputQuantity,
        allocatedQuantity: row.allocatedQuantity,
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
    const plan = await this.plans.getById(planId)
    if (!plan) return { ok: false, error: 'not-found' }
    return {
      ok: true,
      value: {
        planId: plan.id,
        planRevision: plan.revision,
        peopleCount: plan.peopleCount,
        recipes: await this.recipes.getAll(),
        requestedSlots,
        quantityOverrides,
        seed,
      },
    }
  }
}
