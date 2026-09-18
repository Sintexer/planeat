import type { Quantity } from '../../shared/Quantity'
import type { MealSlot } from '../MealSlot'
import { isStandaloneEligible } from './candidates'
import { fingerprintFromInput, type GenerationInput, type MealGenerationProposal } from './proposal'

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
  proposal: MealGenerationProposal,
  live: GenerationInput,
): GenerationApplyError | undefined {
  const slotIssue = validateSlotForGeneration(live.slot, live.slotComponentCount)
  if (slotIssue) return slotIssue
  if (live.slot.id !== proposal.slotId) return 'stale-proposal'
  if (fingerprintFromInput(live) !== proposal.fingerprint) return 'stale-proposal'
  const recipe = live.recipes.find((row) => row.id === proposal.recipeId)
  if (!recipe) return 'recipe-not-found'
  if (!isStandaloneEligible(recipe, live.slot.mealType)) return 'stale-proposal'
  if (
    !isValidPositiveQuantity(proposal.outputQuantity) ||
    !isValidPositiveQuantity(proposal.allocatedQuantity)
  ) {
    return 'invalid-quantity'
  }
  return undefined
}
