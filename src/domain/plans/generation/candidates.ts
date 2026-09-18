import type { Recipe } from '../../recipes/Recipe'
import type { MealType } from '../../shared/MealEnums'
import {
  DEFAULT_GENERATION_HARD_POLICY,
  recipeSatisfiesHardPolicy,
  type GenerationHardPolicy,
} from './constraints'

export function isStandaloneEligible(
  recipe: Recipe,
  mealType: MealType,
  policy: GenerationHardPolicy = DEFAULT_GENERATION_HARD_POLICY,
): boolean {
  return recipeSatisfiesHardPolicy(recipe, mealType, policy)
}

export function compareCandidateRecipes(a: Recipe, b: Recipe): number {
  if (a.id < b.id) return -1
  if (a.id > b.id) return 1
  if (a.name < b.name) return -1
  if (a.name > b.name) return 1
  return 0
}

export function eligibleStandaloneRecipes(
  recipes: readonly Recipe[],
  mealType: MealType,
  policy: GenerationHardPolicy = DEFAULT_GENERATION_HARD_POLICY,
): Recipe[] {
  return recipes
    .filter((recipe) => isStandaloneEligible(recipe, mealType, policy))
    .sort(compareCandidateRecipes)
}

export function selectFirstCandidate(eligible: readonly Recipe[]): Recipe | undefined {
  return eligible[0]
}
