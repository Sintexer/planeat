import type { MealSlot } from '../MealSlot'
import type { Quantity } from '../../shared/Quantity'
import { eligibleStandaloneRecipes, selectFirstCandidate } from './candidates'
import { buildGenerationDiagnostics, DEFAULT_GENERATION_HARD_POLICY } from './constraints'
import {
  fingerprintFromInput,
  GENERATION_ALGORITHM_VERSION,
  GENERATION_POLICY_VERSION,
  type GenerationInput,
  type SlotAssignment,
  type UnfilledSlot,
  type WeekGenerationProposal,
} from './proposal'
import { isValidPositiveQuantity, validateSlotForGeneration } from './proposalValidation'

export type ScaleQuantity = (quantity: Quantity | null, factor: number) => Quantity | null

export function runGenerationSearch(
  input: GenerationInput,
  requestId: string,
  scale: ScaleQuantity,
): WeekGenerationProposal {
  const policy = input.policy ?? DEFAULT_GENERATION_HARD_POLICY
  const catalogs = input.catalogs ?? {
    recipeIds: input.recipes.map((recipe) => recipe.id),
    tagIds: [],
    ingredientIds: [],
  }
  const assignments: SlotAssignment[] = []
  const unfilled: UnfilledSlot[] = []

  for (const requested of input.requestedSlots) {
    const slotIssue = validateSlotForGeneration(requested.slot, requested.componentCount)
    if (slotIssue) {
      unfilled.push(unfilledSlot(requested.slot))
      continue
    }

    const eligible = eligibleStandaloneRecipes(input.recipes, requested.slot.mealType, policy)
    const selected = selectFirstCandidate(eligible)
    if (!selected) {
      unfilled.push(unfilledSlot(requested.slot))
      continue
    }

    const override = input.quantityOverrides?.[requested.slot.id]
    const scaled = override ?? scale(selected.defaultPortionPerPerson, input.peopleCount)
    if (!scaled || !isValidPositiveQuantity(scaled)) {
      unfilled.push(unfilledSlot(requested.slot))
      continue
    }

    assignments.push({
      slotId: requested.slot.id,
      recipeId: selected.id,
      recipeName: selected.name,
      mealType: requested.slot.mealType,
      outputQuantity: scaled,
      allocatedQuantity: scaled,
    })
  }

  const mealTypes = input.requestedSlots.map((row) => row.slot.mealType)
  return {
    requestId,
    algorithmVersion: GENERATION_ALGORITHM_VERSION,
    policyVersion: GENERATION_POLICY_VERSION,
    seed: input.seed,
    fingerprint: fingerprintFromInput(input),
    planId: input.planId,
    quantityOverrides: input.quantityOverrides,
    assignments,
    unfilled,
    diagnostics: buildGenerationDiagnostics(
      input.recipes,
      mealTypes,
      policy,
      input.fixedMeals ?? [],
      catalogs,
    ),
  }
}

function unfilledSlot(slot: MealSlot): UnfilledSlot {
  return {
    slotId: slot.id,
    mealType: slot.mealType,
    reason: 'no-eligible-candidates',
  }
}
