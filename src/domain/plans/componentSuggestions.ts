import type { MealFavorite } from '../favorites/MealFavorite'
import type { RecipePairing } from '../pairings/RecipePairing'
import type { PlanGraph } from '../plans/PlanGraph'
import type { Recipe } from '../recipes/Recipe'
import type { MealType, RecipeRole } from '../shared/MealEnums'
import type { Settings } from '../shared/Settings'
import type { SimpleFood } from '../simpleFoods/SimpleFood'
import type { TagId } from '../tags/Tag'

export type SuggestionKind = 'recipe' | 'simple-food'

export interface SuggestionCandidate {
  kind: SuggestionKind
  id: string
  name: string
  roles: RecipeRole[]
  mealTypes: MealType[]
  score: number
  reason: 'pairing' | 'favorite' | 'role' | 'variety' | 'other'
}

export interface RankSuggestionsInput {
  slotMealType: MealType
  graph: PlanGraph
  slotId: string
  recipes: Recipe[]
  simpleFoods: SimpleFood[]
  pairings: RecipePairing[]
  favorites: MealFavorite[]
  settings: Settings
  previousWeekRecipeIds: Set<string>
  query: string
  /** Resolves live tag IDs to their current label, for the "vegetable" tag heuristic below. */
  tagNamesById: Map<TagId, string>
}

function providesVegetable(roles: RecipeRole[], tags: string[]): boolean {
  return roles.includes('vegetable') || tags.some((t) => t.toLowerCase() === 'vegetable')
}

function resolveTagNames(tagIds: TagId[], tagNamesById: Map<TagId, string>): string[] {
  return tagIds
    .map((id) => tagNamesById.get(id))
    .filter((name): name is string => name !== undefined)
}

function slotRecipeIds(graph: PlanGraph, slotId: string): Set<string> {
  const ids = new Set<string>()
  for (const component of graph.components) {
    if (component.slotId !== slotId) continue
    const source = component.source
    if (source.type !== 'cooking-event') continue
    const event = graph.cookingEvents.find((e) => e.id === source.cookingEventId)
    if (event) ids.add(event.recipeId)
  }
  return ids
}

function slotHasVegetable(
  graph: PlanGraph,
  date: string,
  recipes: Recipe[],
  foods: SimpleFood[],
  tagNamesById: Map<TagId, string>,
): boolean {
  const slotIds = new Set(graph.slots.filter((s) => s.date === date).map((s) => s.id))
  for (const component of graph.components) {
    if (!slotIds.has(component.slotId)) continue
    if (component.role === 'vegetable') return true
    const source = component.source
    if (source.type === 'cooking-event') {
      const event = graph.cookingEvents.find((e) => e.id === source.cookingEventId)
      if (event && providesVegetable(event.recipeSnapshot.roles, event.recipeSnapshot.tags)) {
        return true
      }
      const recipe = recipes.find((r) => r.id === event?.recipeId)
      if (recipe && providesVegetable(recipe.roles, resolveTagNames(recipe.tagIds, tagNamesById))) {
        return true
      }
    } else {
      const food = foods.find((f) => f.id === source.simpleFoodId)
      if (food && providesVegetable(food.roles, resolveTagNames(food.tagIds, tagNamesById))) {
        return true
      }
    }
  }
  return false
}

/**
 * Rank component suggestions. Higher score = better. Caller may further filter with fuse.
 */
export function rankComponentSuggestions(input: RankSuggestionsInput): SuggestionCandidate[] {
  const {
    slotMealType,
    graph,
    slotId,
    recipes,
    simpleFoods,
    pairings,
    favorites,
    settings,
    previousWeekRecipeIds,
    tagNamesById,
  } = input

  const slot = graph.slots.find((s) => s.id === slotId)
  const dayHasVeg = slot
    ? slotHasVegetable(graph, slot.date, recipes, simpleFoods, tagNamesById)
    : false
  const currentRecipeIds = slotRecipeIds(graph, slotId)

  const pairingTargets = new Set<string>()
  for (const recipeId of currentRecipeIds) {
    for (const pairing of pairings) {
      if (pairing.recipeId === recipeId) {
        pairingTargets.add(`${pairing.target.type}:${pairing.target.id}`)
      }
      if (pairing.target.type === 'recipe' && pairing.target.id === recipeId) {
        pairingTargets.add(`recipe:${pairing.recipeId}`)
      }
    }
  }

  const favoritePartnerKeys = new Set<string>()
  for (const favorite of favorites) {
    const hasCurrent = favorite.components.some(
      (c) => c.type === 'recipe' && currentRecipeIds.has(c.recipeId),
    )
    if (!hasCurrent) continue
    for (const component of favorite.components) {
      if (component.type === 'recipe') {
        if (!currentRecipeIds.has(component.recipeId)) {
          favoritePartnerKeys.add(`recipe:${component.recipeId}`)
        }
      } else {
        favoritePartnerKeys.add(`simple-food:${component.simpleFoodId}`)
      }
    }
  }

  const hasMain = [...currentRecipeIds].some((id) => {
    const recipe = recipes.find((r) => r.id === id)
    return recipe?.roles.includes('main') || recipe?.roles.includes('complete')
  })

  const candidates: SuggestionCandidate[] = []

  for (const recipe of recipes) {
    if (currentRecipeIds.has(recipe.id)) continue
    let score = 0
    let reason: SuggestionCandidate['reason'] = 'other'
    const key = `recipe:${recipe.id}`

    if (pairingTargets.has(key)) {
      score += 100
      reason = 'pairing'
    }
    if (favoritePartnerKeys.has(key)) {
      score += 80
      if (reason === 'other') reason = 'favorite'
    }
    if (recipe.mealTypes.includes(slotMealType)) score += 10
    if (hasMain && (recipe.roles.includes('side') || recipe.roles.includes('vegetable'))) {
      score += 25
      if (reason === 'other') reason = 'role'
    }
    if (slotMealType === 'breakfast' && recipe.roles.includes('breakfast-component')) {
      score += 20
      if (reason === 'other') reason = 'role'
    }
    if (
      settings.favorVegetablesDaily &&
      !dayHasVeg &&
      providesVegetable(recipe.roles, resolveTagNames(recipe.tagIds, tagNamesById))
    ) {
      score += 15
      if (reason === 'other') reason = 'variety'
    }
    if (previousWeekRecipeIds.has(recipe.id)) {
      score -= 12
      if (reason === 'other') reason = 'variety'
    }

    candidates.push({
      kind: 'recipe',
      id: recipe.id,
      name: recipe.name,
      roles: recipe.roles,
      mealTypes: recipe.mealTypes,
      score,
      reason,
    })
  }

  for (const food of simpleFoods) {
    if (!food.enabledInSuggestions) continue
    let score = 0
    let reason: SuggestionCandidate['reason'] = 'other'
    const key = `simple-food:${food.id}`

    if (pairingTargets.has(key)) {
      score += 100
      reason = 'pairing'
    }
    if (favoritePartnerKeys.has(key)) {
      score += 80
      if (reason === 'other') reason = 'favorite'
    }
    if (food.mealTypes.includes(slotMealType)) score += 10
    if (hasMain && (food.roles.includes('side') || food.roles.includes('vegetable'))) {
      score += 25
      if (reason === 'other') reason = 'role'
    }
    if (slotMealType === 'breakfast' && food.roles.includes('breakfast-component')) {
      score += 20
      if (reason === 'other') reason = 'role'
    }
    if (
      settings.favorVegetablesDaily &&
      !dayHasVeg &&
      providesVegetable(food.roles, resolveTagNames(food.tagIds, tagNamesById))
    ) {
      score += 15
      if (reason === 'other') reason = 'variety'
    }

    candidates.push({
      kind: 'simple-food',
      id: food.id,
      name: food.name,
      roles: food.roles,
      mealTypes: food.mealTypes,
      score,
      reason,
    })
  }

  return candidates.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
}

export { providesVegetable }
