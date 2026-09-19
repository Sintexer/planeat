import type { MealFavorite } from '../../favorites/MealFavorite'
import type { RecipePairing } from '../../pairings/RecipePairing'
import type { Recipe } from '../../recipes/Recipe'
import type { MealType } from '../../shared/MealEnums'
import type { SimpleFood } from '../../simpleFoods/SimpleFood'
import { recipeExcludeReasons, simpleFoodExcludeReasons } from './constraints'
import { knownCompanions } from './compositions'
import { DEFAULT_GENERATION_HARD_POLICY } from './constraints'
import type { GenerationInput } from './proposal'

export type CapabilityInventory = {
  standaloneMains: Recipe[]
  reusableMains: Recipe[]
  singleMealMains: Recipe[]
  mainsNeedingAccompaniment: Recipe[]
  sides: Recipe[]
  breakfastRecipes: Recipe[]
  simpleFoods: SimpleFood[]
  breakfastFoods: SimpleFood[]
  favorites: MealFavorite[]
  breakfastFavorites: MealFavorite[]
  pairings: RecipePairing[]
  missingMetadata: string[]
  summary: {
    reusableMains: number
    singleMealMains: number
    lowEffortPairedSides: number
    breakfastPatterns: number
  }
}

function recipeEligible(
  recipe: Recipe,
  mealTypes: readonly MealType[],
  input: GenerationInput,
): boolean {
  const policy = input.policy ?? DEFAULT_GENERATION_HARD_POLICY
  if (!mealTypes.some((mealType) => recipe.mealTypes.includes(mealType))) return false
  return recipeExcludeReasons(recipe, policy).length === 0
}

function foodEligible(
  food: SimpleFood,
  mealTypes: readonly MealType[],
  input: GenerationInput,
  requireEnabled: boolean,
): boolean {
  const policy = input.policy ?? DEFAULT_GENERATION_HARD_POLICY
  if (requireEnabled && !food.enabledInSuggestions) return false
  if (!mealTypes.some((mealType) => food.mealTypes.includes(mealType))) return false
  return simpleFoodExcludeReasons(food, policy).length === 0
}

function favoriteOccasion(favorite: MealFavorite, input: GenerationInput): MealType[] {
  const recipes = new Map(input.recipes.map((recipe) => [recipe.id, recipe]))
  const foods = new Map((input.simpleFoods ?? []).map((food) => [food.id, food]))
  const occasions = new Set<MealType>()
  for (const component of favorite.components) {
    if (component.type === 'recipe') {
      const recipe = recipes.get(component.recipeId)
      recipe?.mealTypes.forEach((mealType) => occasions.add(mealType))
    } else {
      const food = foods.get(component.simpleFoodId)
      food?.mealTypes.forEach((mealType) => occasions.add(mealType))
    }
  }
  return [...occasions]
}

export function analyzeCatalog(input: GenerationInput): CapabilityInventory {
  const requestedTypes = [
    ...new Set(input.requestedSlots.map((row) => row.slot.mealType)),
  ] as MealType[]
  const lunchDinner = requestedTypes.filter((mealType) => mealType !== 'breakfast')
  const occasionPool = lunchDinner.length > 0 ? lunchDinner : requestedTypes
  const recipes = input.recipes ?? []
  const foods = input.simpleFoods ?? []
  const policy = input.policy ?? DEFAULT_GENERATION_HARD_POLICY

  const standaloneMains = recipes.filter(
    (recipe) => recipe.roles.includes('complete') && recipeEligible(recipe, occasionPool, input),
  )
  const mainsNeedingAccompaniment = recipes.filter((recipe) => {
    if (recipe.roles.includes('complete')) return false
    if (!recipe.roles.includes('main')) return false
    if (!recipeEligible(recipe, occasionPool, input)) return false
    return occasionPool.some((mealType) => knownCompanions(recipe.id, input, mealType).length > 0)
  })
  const reusableMains = [...standaloneMains, ...mainsNeedingAccompaniment].filter(
    (recipe) => recipe.reusePolicy === 'batch-friendly',
  )
  const singleMealMains = [...standaloneMains, ...mainsNeedingAccompaniment].filter(
    (recipe) => recipe.reusePolicy !== 'batch-friendly',
  )
  const sides = recipes.filter(
    (recipe) =>
      (recipe.roles.includes('side') || recipe.roles.includes('vegetable')) &&
      !recipe.roles.includes('main') &&
      recipeEligible(recipe, occasionPool, input),
  )
  const breakfastRecipes = recipes.filter(
    (recipe) =>
      recipe.mealTypes.includes('breakfast') &&
      recipeExcludeReasons(recipe, policy).length === 0 &&
      (recipe.roles.includes('complete') || recipe.roles.includes('breakfast-component')),
  )
  const simpleFoods = foods.filter((food) => foodEligible(food, occasionPool, input, true))
  const breakfastFoods = foods.filter((food) => foodEligible(food, ['breakfast'], input, true))
  const favorites = [...(input.favorites ?? [])]
  const breakfastFavorites = favorites.filter((favorite) =>
    favoriteOccasion(favorite, input).includes('breakfast'),
  )

  const pairedSideIds = new Set<string>()
  for (const main of [...standaloneMains, ...mainsNeedingAccompaniment]) {
    for (const mealType of occasionPool) {
      for (const companion of knownCompanions(main.id, input, mealType)) {
        if (companion.part.type === 'recipe' && companion.part.recipe.effort === 'quick') {
          pairedSideIds.add(companion.part.recipe.id)
        }
      }
    }
  }

  const missingMetadata: string[] = []
  const missingTime = recipes.filter(
    (recipe) =>
      recipe.totalTimeMinutes === undefined && recipeEligible(recipe, requestedTypes, input),
  ).length
  if (missingTime > 0) missingMetadata.push(`missing-total-time:${missingTime}`)
  if (reusableMains.length === 0 && occasionPool.length > 0) {
    missingMetadata.push('no-reusable-mains')
  }

  return {
    standaloneMains,
    reusableMains,
    singleMealMains,
    mainsNeedingAccompaniment,
    sides,
    breakfastRecipes,
    simpleFoods,
    breakfastFoods,
    favorites,
    breakfastFavorites,
    pairings: [...(input.pairings ?? [])],
    missingMetadata,
    summary: {
      reusableMains: reusableMains.length,
      singleMealMains: singleMealMains.length,
      lowEffortPairedSides: pairedSideIds.size,
      breakfastPatterns:
        breakfastFavorites.length + breakfastRecipes.length + breakfastFoods.length,
    },
  }
}
