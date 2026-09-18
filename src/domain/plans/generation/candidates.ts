import type { Recipe } from '../../recipes/Recipe'
import type { MealType } from '../../shared/MealEnums'

export function isStandaloneEligible(recipe: Recipe, mealType: MealType): boolean {
  return recipe.roles.includes('complete') && recipe.mealTypes.includes(mealType)
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
): Recipe[] {
  return recipes
    .filter((recipe) => isStandaloneEligible(recipe, mealType))
    .sort(compareCandidateRecipes)
}

export function selectFirstCandidate(eligible: readonly Recipe[]): Recipe | undefined {
  return eligible[0]
}
