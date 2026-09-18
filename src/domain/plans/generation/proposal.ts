import type { Recipe, RecipeId } from '../../recipes/Recipe'
import type { MealType } from '../../shared/MealEnums'
import type { Quantity } from '../../shared/Quantity'
import type { MealSlot, MealSlotId } from '../MealSlot'
import type { PlanId } from '../Plan'
import { eligibleStandaloneRecipes } from './candidates'

export const GENERATION_ALGORITHM_VERSION = '28'
export const GENERATION_POLICY_VERSION = '28-empty'

export type GenerationInput = {
  planId: PlanId
  planRevision: number
  peopleCount: number
  slot: MealSlot
  slotComponentCount: number
  recipes: readonly Recipe[]
}

export type MealGenerationProposal = {
  requestId: string
  algorithmVersion: string
  policyVersion: string
  fingerprint: string
  slotId: MealSlotId
  recipeId: RecipeId
  recipeName: string
  mealType: MealType
  outputQuantity: Quantity
  allocatedQuantity: Quantity
}

export type GenerationFingerprintParts = {
  algorithmVersion: string
  policyVersion: string
  planId: string
  planRevision: number
  peopleCount: number
  slotId: string
  mealType: string
  eligible: readonly { id: string; updatedAt: number }[]
}

export function generationInputFingerprint(parts: GenerationFingerprintParts): string {
  const eligible = [...parts.eligible]
    .map((row) => ({ id: row.id, updatedAt: row.updatedAt }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return JSON.stringify({
    algorithmVersion: parts.algorithmVersion,
    policyVersion: parts.policyVersion,
    planId: parts.planId,
    planRevision: parts.planRevision,
    peopleCount: parts.peopleCount,
    slotId: parts.slotId,
    mealType: parts.mealType,
    eligible,
  })
}

export function fingerprintFromInput(input: GenerationInput): string {
  const eligible = eligibleStandaloneRecipes(input.recipes, input.slot.mealType)
  return generationInputFingerprint({
    algorithmVersion: GENERATION_ALGORITHM_VERSION,
    policyVersion: GENERATION_POLICY_VERSION,
    planId: input.planId,
    planRevision: input.planRevision,
    peopleCount: input.peopleCount,
    slotId: input.slot.id,
    mealType: input.slot.mealType,
    eligible: eligible.map((recipe) => ({ id: recipe.id, updatedAt: recipe.updatedAt })),
  })
}
