import type { Recipe, RecipeId } from '../../recipes/Recipe'
import type { MealType } from '../../shared/MealEnums'
import type { Quantity } from '../../shared/Quantity'
import type { MealSlot, MealSlotId } from '../MealSlot'
import type { PlanId } from '../Plan'
import { eligibleStandaloneRecipes } from './candidates'
import {
  canonicalizeGenerationHardPolicy,
  DEFAULT_GENERATION_HARD_POLICY,
  type FixedMeal,
  type GenerationDiagnostics,
  type GenerationHardPolicy,
} from './constraints'

export const GENERATION_ALGORITHM_VERSION = '30'
export const GENERATION_POLICY_VERSION = '30'

export type RequestedGenerationSlot = {
  slot: MealSlot
  componentCount: number
}

export type GenerationCatalogIds = {
  recipeIds: readonly string[]
  tagIds: readonly string[]
  ingredientIds: readonly string[]
}

export type GenerationInput = {
  planId: PlanId
  planRevision: number
  peopleCount: number
  recipes: readonly Recipe[]
  requestedSlots: readonly RequestedGenerationSlot[]
  quantityOverrides?: Readonly<Record<string, Quantity>>
  seed: string
  policy: GenerationHardPolicy
  fixedMeals: readonly FixedMeal[]
  catalogs: GenerationCatalogIds
}

export type SlotAssignment = {
  slotId: MealSlotId
  recipeId: RecipeId
  recipeName: string
  mealType: MealType
  outputQuantity: Quantity
  allocatedQuantity: Quantity
}

export type UnfilledSlot = {
  slotId: MealSlotId
  mealType: MealType
  reason: 'no-eligible-candidates'
}

export type WeekGenerationProposal = {
  requestId: string
  algorithmVersion: string
  policyVersion: string
  seed: string
  fingerprint: string
  planId: PlanId
  quantityOverrides?: Readonly<Record<string, Quantity>>
  assignments: SlotAssignment[]
  unfilled: UnfilledSlot[]
  diagnostics: GenerationDiagnostics
}

/** Sprint 28 name: a week proposal, often with a single assignment. */
export type MealGenerationProposal = WeekGenerationProposal

export type GenerationFingerprintParts = {
  algorithmVersion: string
  policyVersion: string
  planId: string
  planRevision: number
  peopleCount: number
  seed: string
  requested: readonly { slotId: string; mealType: string }[]
  eligible: readonly { id: string; updatedAt: number }[]
  overrides: readonly { slotId: string; value: number; unit: string }[]
  policy: GenerationHardPolicy
}

export function generationInputFingerprint(parts: GenerationFingerprintParts): string {
  const eligible = [...parts.eligible]
    .map((row) => ({ id: row.id, updatedAt: row.updatedAt }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const requested = [...parts.requested].sort((a, b) =>
    a.slotId < b.slotId ? -1 : a.slotId > b.slotId ? 1 : 0,
  )
  const overrides = [...parts.overrides].sort((a, b) =>
    a.slotId < b.slotId ? -1 : a.slotId > b.slotId ? 1 : 0,
  )
  return JSON.stringify({
    algorithmVersion: parts.algorithmVersion,
    policyVersion: parts.policyVersion,
    planId: parts.planId,
    planRevision: parts.planRevision,
    peopleCount: parts.peopleCount,
    seed: parts.seed,
    requested,
    eligible,
    overrides,
    policy: canonicalizeGenerationHardPolicy(parts.policy),
  })
}

export function fingerprintFromInput(input: GenerationInput): string {
  const policy = input.policy ?? DEFAULT_GENERATION_HARD_POLICY
  const mealTypes = [...new Set(input.requestedSlots.map((row) => row.slot.mealType))]
  const eligibleIds = new Map<string, number>()
  for (const mealType of mealTypes) {
    for (const recipe of eligibleStandaloneRecipes(input.recipes, mealType, policy)) {
      eligibleIds.set(recipe.id, recipe.updatedAt)
    }
  }
  const overrides = Object.entries(input.quantityOverrides ?? {}).map(([slotId, quantity]) => ({
    slotId,
    value: quantity.value,
    unit: quantity.unit,
  }))
  return generationInputFingerprint({
    algorithmVersion: GENERATION_ALGORITHM_VERSION,
    policyVersion: GENERATION_POLICY_VERSION,
    planId: input.planId,
    planRevision: input.planRevision,
    peopleCount: input.peopleCount,
    seed: input.seed,
    requested: input.requestedSlots.map((row) => ({
      slotId: row.slot.id,
      mealType: row.slot.mealType,
    })),
    eligible: [...eligibleIds.entries()].map(([id, updatedAt]) => ({ id, updatedAt })),
    overrides,
    policy,
  })
}
