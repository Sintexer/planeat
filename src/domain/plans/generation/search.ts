import type { MealSlot } from '../MealSlot'
import type { Quantity } from '../../shared/Quantity'
import { eligibleStandaloneRecipes } from './candidates'
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
import { DEFAULT_GENERATION_SOFT_PREFS, selectBestCandidate, type ScoringContext } from './scoring'

export type ScaleQuantity = (quantity: Quantity | null, factor: number) => Quantity | null

const MEAL_ORDER = { breakfast: 0, lunch: 1, dinner: 2 } as const

export function runGenerationSearch(
  input: GenerationInput,
  requestId: string,
  scale: ScaleQuantity,
): WeekGenerationProposal {
  const policy = input.policy ?? DEFAULT_GENERATION_HARD_POLICY
  const softPrefs = input.softPrefs ?? DEFAULT_GENERATION_SOFT_PREFS
  const catalogs = input.catalogs ?? {
    recipeIds: input.recipes.map((recipe) => recipe.id),
    tagIds: [],
    ingredientIds: [],
  }
  const assignments: SlotAssignment[] = []
  const unfilled: UnfilledSlot[] = []
  const weekRecipeIds = [
    ...(input.fixedMeals ?? []).flatMap((meal) => (meal.recipeId ? [meal.recipeId] : [])),
  ]
  const demandingByDate = new Map<string, number>()
  const cooksByDate = new Map<string, number>()

  for (const meal of input.fixedMeals ?? []) {
    cooksByDate.set(meal.date, (cooksByDate.get(meal.date) ?? 0) + (meal.recipeId ? 1 : 0))
    const effort = meal.recipe?.effort
    if (effort === 'demanding') {
      demandingByDate.set(meal.date, (demandingByDate.get(meal.date) ?? 0) + 1)
    }
  }

  const requested = [...input.requestedSlots].sort((a, b) => {
    if (a.slot.date !== b.slot.date) return a.slot.date < b.slot.date ? -1 : 1
    const meal = MEAL_ORDER[a.slot.mealType] - MEAL_ORDER[b.slot.mealType]
    if (meal !== 0) return meal
    return a.slot.id < b.slot.id ? -1 : a.slot.id > b.slot.id ? 1 : 0
  })

  for (const row of requested) {
    const slotIssue = validateSlotForGeneration(row.slot, row.componentCount)
    if (slotIssue) {
      unfilled.push(unfilledSlot(row.slot))
      continue
    }

    const ctx: ScoringContext = {
      date: row.slot.date,
      mealType: row.slot.mealType,
      prefs: softPrefs,
      weekRecipeIds,
      previousWeekRecipeIds: input.previousWeekRecipeIds ?? [],
      demandingCooksOnDate: demandingByDate.get(row.slot.date) ?? 0,
      cookingEventCountOnDate: cooksByDate.get(row.slot.date) ?? 0,
      tagNamesById: input.tagNamesById ?? {},
    }
    const eligible = eligibleStandaloneRecipes(input.recipes, row.slot.mealType, policy)
    const selected = selectBestCandidate(eligible, ctx)
    if (!selected) {
      unfilled.push(unfilledSlot(row.slot))
      continue
    }

    const override = input.quantityOverrides?.[row.slot.id]
    const scaled = override ?? scale(selected.recipe.defaultPortionPerPerson, input.peopleCount)
    if (!scaled || !isValidPositiveQuantity(scaled)) {
      unfilled.push(unfilledSlot(row.slot))
      continue
    }

    assignments.push({
      slotId: row.slot.id,
      recipeId: selected.recipe.id,
      recipeName: selected.recipe.name,
      mealType: row.slot.mealType,
      outputQuantity: scaled,
      allocatedQuantity: scaled,
      scoreReasons: selected.scoreReasons,
    })
    weekRecipeIds.push(selected.recipe.id)
    cooksByDate.set(row.slot.date, (cooksByDate.get(row.slot.date) ?? 0) + 1)
    if (selected.recipe.effort === 'demanding') {
      demandingByDate.set(row.slot.date, (demandingByDate.get(row.slot.date) ?? 0) + 1)
    }
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
