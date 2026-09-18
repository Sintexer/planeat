import type { PlanRepository } from '../ports/PlanRepository'
import type { RecipeRepository } from '../ports/RecipeRepository'
import type { QuantityService } from '../quantities/QuantityService'
import type { MealComponent } from '../../domain/plans/MealComponent'
import type { MealSlotId } from '../../domain/plans/MealSlot'
import {
  eligibleStandaloneRecipes,
  selectFirstCandidate,
} from '../../domain/plans/generation/candidates'
import {
  fingerprintFromInput,
  GENERATION_ALGORITHM_VERSION,
  GENERATION_POLICY_VERSION,
  type GenerationInput,
  type MealGenerationProposal,
} from '../../domain/plans/generation/proposal'
import {
  isValidPositiveQuantity,
  validateProposalAgainstLive,
  validateSlotForGeneration,
} from '../../domain/plans/generation/proposalValidation'
import { PlanService, type PlanError } from './PlanService'

export type GenerationError =
  'no-eligible-candidates' | 'slot-not-empty' | 'slot-excluded' | 'stale-proposal' | PlanError

export type GenerationResult<T> = { ok: true; value: T } | { ok: false; error: GenerationError }

export class GenerationService {
  private readonly plans: PlanRepository
  private readonly recipes: RecipeRepository
  private readonly quantities: QuantityService
  private readonly planService: PlanService

  constructor(
    plans: PlanRepository,
    recipes: RecipeRepository,
    quantities: QuantityService,
    planService: PlanService,
  ) {
    this.plans = plans
    this.recipes = recipes
    this.quantities = quantities
    this.planService = planService
  }

  async prepareGeneration(slotId: MealSlotId): Promise<GenerationResult<GenerationInput>> {
    const slot = await this.plans.getSlot(slotId)
    if (!slot) return { ok: false, error: 'slot-not-found' }
    const plan = await this.plans.getById(slot.planId)
    if (!plan) return { ok: false, error: 'not-found' }
    const components = await this.plans.listComponentsForSlot(slotId)
    const recipes = await this.recipes.getAll()
    const slotIssue = validateSlotForGeneration(slot, components.length)
    if (slotIssue) return { ok: false, error: slotIssue }
    return {
      ok: true,
      value: {
        planId: plan.id,
        planRevision: plan.revision,
        peopleCount: plan.peopleCount,
        slot,
        slotComponentCount: components.length,
        recipes,
      },
    }
  }

  runGeneration(
    input: GenerationInput,
    requestId: string = crypto.randomUUID(),
  ): GenerationResult<MealGenerationProposal> {
    const slotIssue = validateSlotForGeneration(input.slot, input.slotComponentCount)
    if (slotIssue) return { ok: false, error: slotIssue }

    const eligible = eligibleStandaloneRecipes(input.recipes, input.slot.mealType)
    const selected = selectFirstCandidate(eligible)
    if (!selected) return { ok: false, error: 'no-eligible-candidates' }

    const scaled = this.quantities.scale(selected.defaultPortionPerPerson, input.peopleCount)
    if (!scaled || !isValidPositiveQuantity(scaled)) {
      return { ok: false, error: 'invalid-quantity' }
    }

    return {
      ok: true,
      value: {
        requestId,
        algorithmVersion: GENERATION_ALGORITHM_VERSION,
        policyVersion: GENERATION_POLICY_VERSION,
        fingerprint: fingerprintFromInput(input),
        slotId: input.slot.id,
        recipeId: selected.id,
        recipeName: selected.name,
        mealType: input.slot.mealType,
        outputQuantity: scaled,
        allocatedQuantity: scaled,
      },
    }
  }

  async applyProposal(proposal: MealGenerationProposal): Promise<GenerationResult<MealComponent>> {
    const live = await this.loadLiveInput(proposal.slotId)
    if (!live.ok) return live
    const issue = validateProposalAgainstLive(proposal, live.value)
    if (issue) return { ok: false, error: issue }

    const result = await this.planService.addNewCookingEventComponent(
      proposal.slotId,
      proposal.recipeId,
      {
        outputQuantity: proposal.outputQuantity,
        allocatedQuantity: proposal.allocatedQuantity,
      },
    )
    if (!result.ok) return result
    return { ok: true, value: result.component }
  }

  cancel(_proposal?: MealGenerationProposal): void {
    void _proposal
  }

  private async loadLiveInput(slotId: MealSlotId): Promise<GenerationResult<GenerationInput>> {
    const slot = await this.plans.getSlot(slotId)
    if (!slot) return { ok: false, error: 'slot-not-found' }
    const plan = await this.plans.getById(slot.planId)
    if (!plan) return { ok: false, error: 'not-found' }
    const components = await this.plans.listComponentsForSlot(slotId)
    const recipes = await this.recipes.getAll()
    return {
      ok: true,
      value: {
        planId: plan.id,
        planRevision: plan.revision,
        peopleCount: plan.peopleCount,
        slot,
        slotComponentCount: components.length,
        recipes,
      },
    }
  }
}
