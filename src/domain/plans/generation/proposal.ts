import type { Recipe } from '../../recipes/Recipe'
import type { MealType, RecipeRole, ReusePolicy } from '../../shared/MealEnums'
import type { Quantity } from '../../shared/Quantity'
import type { LocalDate } from '../../shared/LocalDate'
import type { MealSlot, MealSlotId } from '../MealSlot'
import type { PlanId } from '../Plan'
import type { CookingEventId } from '../CookingEvent'
import type { MealFavorite } from '../../favorites/MealFavorite'
import type { RecipePairing } from '../../pairings/RecipePairing'
import type { SimpleFood } from '../../simpleFoods/SimpleFood'
import { eligibleStandaloneRecipes } from './candidates'
import {
  canonicalizeGenerationHardPolicy,
  DEFAULT_GENERATION_HARD_POLICY,
  type FixedMeal,
  type GenerationDiagnostics,
  type GenerationHardPolicy,
} from './constraints'
import {
  canonicalizeGenerationSoftPrefs,
  DEFAULT_GENERATION_SOFT_PREFS,
  type GenerationSoftPrefs,
  type ScoreReason,
} from './scoring'

export const GENERATION_ALGORITHM_VERSION = '36'
export const GENERATION_POLICY_VERSION = '31'

export const GENERATION_MODES = ['fill-empty', 'replace'] as const
export type GenerationMode = (typeof GENERATION_MODES)[number]
export const DEFAULT_GENERATION_MODE: GenerationMode = 'fill-empty'

export function mergeGenerationMode(mode?: GenerationMode): GenerationMode {
  return mode === 'replace' ? 'replace' : 'fill-empty'
}

export type GenerationSearchBudget = {
  beamWidth: number
  expansionBudget: number
  perSlotCandidateLimit: number
}

export const DEFAULT_GENERATION_SEARCH_BUDGET: GenerationSearchBudget = {
  beamWidth: 8,
  expansionBudget: 400,
  perSlotCandidateLimit: 8,
}

const MAX_BEAM_WIDTH = 32
const MAX_EXPANSION_BUDGET = 10_000
const MAX_PER_SLOT_CANDIDATES = 32

function clampBudgetInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(value)))
}

export function mergeGenerationSearchBudget(
  row?: Partial<GenerationSearchBudget> | null,
): GenerationSearchBudget {
  return {
    beamWidth: clampBudgetInt(
      row?.beamWidth,
      DEFAULT_GENERATION_SEARCH_BUDGET.beamWidth,
      1,
      MAX_BEAM_WIDTH,
    ),
    expansionBudget: clampBudgetInt(
      row?.expansionBudget,
      DEFAULT_GENERATION_SEARCH_BUDGET.expansionBudget,
      1,
      MAX_EXPANSION_BUDGET,
    ),
    perSlotCandidateLimit: clampBudgetInt(
      row?.perSlotCandidateLimit,
      DEFAULT_GENERATION_SEARCH_BUDGET.perSlotCandidateLimit,
      1,
      MAX_PER_SLOT_CANDIDATES,
    ),
  }
}

export function canonicalizeGenerationSearchBudget(
  budget: GenerationSearchBudget,
): GenerationSearchBudget {
  return mergeGenerationSearchBudget(budget)
}

export type GenerationCompositionBounds = {
  maxPairingsPerRecipe: number
  maxComponentsPerCandidate: number
}

export const DEFAULT_GENERATION_COMPOSITION_BOUNDS: GenerationCompositionBounds = {
  maxPairingsPerRecipe: 2,
  maxComponentsPerCandidate: 4,
}

export function mergeGenerationCompositionBounds(
  row?: Partial<GenerationCompositionBounds> | null,
): GenerationCompositionBounds {
  return {
    maxPairingsPerRecipe: clampBudgetInt(
      row?.maxPairingsPerRecipe,
      DEFAULT_GENERATION_COMPOSITION_BOUNDS.maxPairingsPerRecipe,
      1,
      8,
    ),
    maxComponentsPerCandidate: clampBudgetInt(
      row?.maxComponentsPerCandidate,
      DEFAULT_GENERATION_COMPOSITION_BOUNDS.maxComponentsPerCandidate,
      1,
      8,
    ),
  }
}

export function canonicalizeGenerationCompositionBounds(
  bounds: GenerationCompositionBounds,
): GenerationCompositionBounds {
  return mergeGenerationCompositionBounds(bounds)
}

export const UNALLOCATED_PRODUCTION_POLICIES = ['disallow', 'allow-with-warning'] as const
export type UnallocatedProductionPolicy = (typeof UNALLOCATED_PRODUCTION_POLICIES)[number]

export type GenerationBatchPolicy = {
  maxExtraPlannedUses: number
  unallocatedProduction: UnallocatedProductionPolicy
}

export const DEFAULT_GENERATION_BATCH_POLICY: GenerationBatchPolicy = {
  maxExtraPlannedUses: 0,
  unallocatedProduction: 'disallow',
}

const MAX_EXTRA_PLANNED_USES = 3

function parseUnallocatedProduction(value: unknown): UnallocatedProductionPolicy {
  return value === 'allow-with-warning' ? 'allow-with-warning' : 'disallow'
}

export function mergeGenerationBatchPolicy(
  row?: Partial<GenerationBatchPolicy> | null,
): GenerationBatchPolicy {
  return {
    maxExtraPlannedUses: clampBudgetInt(
      row?.maxExtraPlannedUses,
      DEFAULT_GENERATION_BATCH_POLICY.maxExtraPlannedUses,
      0,
      MAX_EXTRA_PLANNED_USES,
    ),
    unallocatedProduction: parseUnallocatedProduction(row?.unallocatedProduction),
  }
}

export function canonicalizeGenerationBatchPolicy(
  policy: GenerationBatchPolicy,
): GenerationBatchPolicy {
  return mergeGenerationBatchPolicy(policy)
}

export type RequestedGenerationSlot = {
  slot: MealSlot
  componentCount: number
  existingLabels?: readonly string[]
}

export type GenerationCatalogIds = {
  recipeIds: readonly string[]
  tagIds: readonly string[]
  ingredientIds: readonly string[]
}

export type GenerationLeftoverEvent = {
  id: CookingEventId
  recipeId: string
  recipeName: string
  scheduledDate: LocalDate
  outputQuantity: Quantity
  remaining: Quantity
  desiredQuantity?: Quantity
  reusePolicy: ReusePolicy
  mealTypes: readonly MealType[]
  recipe: Recipe
  role?: RecipeRole
  proposed?: boolean
  producerSlotId?: MealSlotId
}

export type GenerationInput = {
  planId: PlanId
  planRevision: number
  peopleCount: number
  recipes: readonly Recipe[]
  simpleFoods?: readonly SimpleFood[]
  favorites?: readonly MealFavorite[]
  pairings?: readonly RecipePairing[]
  cookingEvents?: readonly GenerationLeftoverEvent[]
  requestedSlots: readonly RequestedGenerationSlot[]
  quantityOverrides?: Readonly<Record<string, Quantity>>
  seed: string
  policy: GenerationHardPolicy
  fixedMeals: readonly FixedMeal[]
  catalogs: GenerationCatalogIds
  softPrefs: GenerationSoftPrefs
  previousWeekRecipeIds: readonly string[]
  tagNamesById: Readonly<Record<string, string>>
  searchBudget?: GenerationSearchBudget
  compositionBounds?: GenerationCompositionBounds
  batchPolicy?: GenerationBatchPolicy
  generationMode?: GenerationMode
}

export type SlotAssignmentSource =
  | { type: 'standalone' }
  | { type: 'favorite'; favoriteId: string; favoriteName: string }
  | { type: 'pairing'; pairingId: string }
  | { type: 'leftover'; cookingEventId: CookingEventId }

export type GeneratedComponent =
  | {
      type: 'recipe'
      recipeId: string
      recipeName: string
      outputQuantity: Quantity
      allocatedQuantity: Quantity
      role?: RecipeRole
      proposedEventId?: string
    }
  | {
      type: 'simple-food'
      simpleFoodId: string
      name: string
      allocatedQuantity: Quantity
      role?: RecipeRole
    }
  | {
      type: 'leftover'
      cookingEventId: CookingEventId
      recipeId: string
      recipeName: string
      scheduledDate: LocalDate
      allocatedQuantity: Quantity
      role?: RecipeRole
      proposedEventId?: string
    }

export type ProposedCookingEvent = {
  id: string
  recipeId: string
  recipeName: string
  scheduledDate: LocalDate
  outputQuantity: Quantity
  producerSlotId: MealSlotId
}

export type SlotAssignment = {
  slotId: MealSlotId
  mealType: MealType
  source: SlotAssignmentSource
  components: GeneratedComponent[]
  scoreReasons: ScoreReason[]
}

export type UnfilledReason = 'no-eligible-candidates' | 'search-incomplete'

export type UnfilledSlot = {
  slotId: MealSlotId
  mealType: MealType
  reason: UnfilledReason
}

export type ReplacementPreviewSlot = {
  slotId: MealSlotId
  date: LocalDate
  mealType: MealType
  removedNames: readonly string[]
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
  budgetUsed: GenerationSearchBudget
  expansionsUsed: number
  proposedCookingEvents?: ProposedCookingEvent[]
  generationMode?: GenerationMode
  replacementPreview?: readonly ReplacementPreviewSlot[]
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
  generationMode: GenerationMode
  requested: readonly { slotId: string; mealType: string; generationLocked: boolean }[]
  eligible: readonly { id: string; updatedAt: number }[]
  overrides: readonly { slotId: string; value: number; unit: string }[]
  policy: GenerationHardPolicy
  softPrefs: GenerationSoftPrefs
  previousWeekRecipeIds: readonly string[]
  searchBudget: GenerationSearchBudget
  compositionBounds: GenerationCompositionBounds
  batchPolicy: GenerationBatchPolicy
  simpleFoods: readonly { id: string; updatedAt: number }[]
  favorites: readonly { id: string; updatedAt: number }[]
  pairings: readonly { id: string }[]
  cookingEvents: readonly {
    id: string
    scheduledDate: string
    outputValue: number
    outputUnit: string
    remainingValue: number
    remainingUnit: string
  }[]
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
    generationMode: parts.generationMode,
    requested,
    eligible,
    overrides,
    policy: canonicalizeGenerationHardPolicy(parts.policy),
    softPrefs: canonicalizeGenerationSoftPrefs(parts.softPrefs),
    previousWeekRecipeIds: [...parts.previousWeekRecipeIds].sort((a, b) =>
      a < b ? -1 : a > b ? 1 : 0,
    ),
    searchBudget: canonicalizeGenerationSearchBudget(parts.searchBudget),
    compositionBounds: canonicalizeGenerationCompositionBounds(parts.compositionBounds),
    batchPolicy: canonicalizeGenerationBatchPolicy(parts.batchPolicy),
    simpleFoods: [...parts.simpleFoods].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    favorites: [...parts.favorites].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    pairings: [...parts.pairings].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    cookingEvents: [...parts.cookingEvents].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    ),
  })
}

export function fingerprintFromInput(input: GenerationInput): string {
  const policy = input.policy ?? DEFAULT_GENERATION_HARD_POLICY
  const softPrefs = input.softPrefs ?? DEFAULT_GENERATION_SOFT_PREFS
  const searchBudget = mergeGenerationSearchBudget(input.searchBudget)
  const compositionBounds = mergeGenerationCompositionBounds(input.compositionBounds)
  const batchPolicy = mergeGenerationBatchPolicy(input.batchPolicy)
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
    generationMode: mergeGenerationMode(input.generationMode),
    requested: input.requestedSlots.map((row) => ({
      slotId: row.slot.id,
      mealType: row.slot.mealType,
      generationLocked: row.slot.generationLocked === true,
    })),
    eligible: [...eligibleIds.entries()].map(([id, updatedAt]) => ({ id, updatedAt })),
    overrides,
    policy,
    softPrefs,
    previousWeekRecipeIds: input.previousWeekRecipeIds ?? [],
    searchBudget,
    compositionBounds,
    batchPolicy,
    simpleFoods: (input.simpleFoods ?? []).map((food) => ({
      id: food.id,
      updatedAt: food.updatedAt,
    })),
    favorites: (input.favorites ?? []).map((favorite) => ({
      id: favorite.id,
      updatedAt: favorite.updatedAt,
    })),
    pairings: (input.pairings ?? []).map((pairing) => ({ id: pairing.id })),
    cookingEvents: (input.cookingEvents ?? []).map((event) => ({
      id: event.id,
      scheduledDate: event.scheduledDate,
      outputValue: event.outputQuantity.value,
      outputUnit: event.outputQuantity.unit,
      remainingValue: event.remaining.value,
      remainingUnit: event.remaining.unit,
    })),
  })
}
