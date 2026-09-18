import type { Quantity } from '../../shared/Quantity'
import type { MealSlot } from '../MealSlot'
import { isStandaloneEligible } from './candidates'
import { DEFAULT_GENERATION_HARD_POLICY } from './constraints'
import { fingerprintFromInput, type GenerationInput, type WeekGenerationProposal } from './proposal'

export type GenerationSlotError = 'slot-excluded' | 'slot-not-empty'

export type GenerationApplyError =
  | GenerationSlotError
  | 'slot-not-found'
  | 'not-found'
  | 'stale-proposal'
  | 'recipe-not-found'
  | 'invalid-quantity'

export function isValidPositiveQuantity(quantity: Quantity): boolean {
  return Number.isFinite(quantity.value) && quantity.value > 0 && quantity.unit.length > 0
}

export function validateSlotForGeneration(
  slot: MealSlot,
  componentCount: number,
): GenerationSlotError | undefined {
  if (slot.excluded) return 'slot-excluded'
  if (componentCount > 0) return 'slot-not-empty'
  return undefined
}

export function validateProposalAgainstLive(
  proposal: WeekGenerationProposal,
  live: GenerationInput,
): GenerationApplyError | undefined {
  if (live.planId !== proposal.planId) return 'stale-proposal'
  if (fingerprintFromInput(live) !== proposal.fingerprint) return 'stale-proposal'

  const liveById = new Map(live.requestedSlots.map((row) => [row.slot.id, row]))

  for (const assignment of proposal.assignments) {
    const requested = liveById.get(assignment.slotId)
    if (!requested) return 'slot-not-found'
    const slotIssue = validateSlotForGeneration(requested.slot, requested.componentCount)
    if (slotIssue) return slotIssue
    const recipe = live.recipes.find((row) => row.id === assignment.recipeId)
    if (!recipe) return 'recipe-not-found'
    if (
      !isStandaloneEligible(
        recipe,
        requested.slot.mealType,
        live.policy ?? DEFAULT_GENERATION_HARD_POLICY,
      )
    ) {
      return 'stale-proposal'
    }
    if (
      !isValidPositiveQuantity(assignment.outputQuantity) ||
      !isValidPositiveQuantity(assignment.allocatedQuantity)
    ) {
      return 'invalid-quantity'
    }
  }

  return undefined
}
