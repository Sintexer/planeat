import type { MealFavorite } from '../../favorites/MealFavorite'
import type { Recipe } from '../../recipes/Recipe'
import type { SimpleFood } from '../../simpleFoods/SimpleFood'
import type { MealType } from '../../shared/MealEnums'
import type { CapabilityInventory } from './capabilities'
import type { CompositionCandidate, CompositionPart } from './compositions'
import type { GenerationInput } from './proposal'
import type { RecencyState } from './recency'
import { recencyPenalty } from './recency'
import type { LocalDate } from '../../shared/LocalDate'

export type BreakfastPattern = {
  id: string
  source: CompositionCandidate['source']
  parts: CompositionPart[]
}

function favoriteIsBreakfast(favorite: MealFavorite, input: GenerationInput): boolean {
  const recipes = new Map(input.recipes.map((recipe) => [recipe.id, recipe]))
  const foods = new Map((input.simpleFoods ?? []).map((food) => [food.id, food]))
  return favorite.components.every((component) => {
    if (component.type === 'recipe') {
      return recipes.get(component.recipeId)?.mealTypes.includes('breakfast') === true
    }
    return foods.get(component.simpleFoodId)?.mealTypes.includes('breakfast') === true
  })
}

export function breakfastPatterns(
  input: GenerationInput,
  capabilities: CapabilityInventory,
): BreakfastPattern[] {
  const out: BreakfastPattern[] = []
  for (const favorite of capabilities.breakfastFavorites) {
    if (!favoriteIsBreakfast(favorite, input)) continue
    const parts: CompositionPart[] = []
    let valid = true
    for (const component of favorite.components) {
      if (component.type === 'recipe') {
        const recipe = input.recipes.find((row) => row.id === component.recipeId)
        if (!recipe) {
          valid = false
          break
        }
        parts.push({
          type: 'recipe',
          recipe,
          role: component.role,
          favoriteQuantity: component.allocatedQuantity,
        })
      } else {
        const food = (input.simpleFoods ?? []).find((row) => row.id === component.simpleFoodId)
        if (!food) {
          valid = false
          break
        }
        parts.push({
          type: 'simple-food',
          food,
          role: component.role,
          favoriteQuantity: component.allocatedQuantity,
        })
      }
    }
    if (!valid || parts.length === 0) continue
    out.push({
      id: `favorite:${favorite.id}`,
      source: { type: 'favorite', favoriteId: favorite.id, favoriteName: favorite.name },
      parts,
    })
  }
  for (const recipe of capabilities.breakfastRecipes) {
    if (!recipe.roles.includes('complete')) continue
    out.push({
      id: `standalone:recipe:${recipe.id}`,
      source: { type: 'standalone' },
      parts: [{ type: 'recipe', recipe }],
    })
  }
  for (const food of capabilities.breakfastFoods) {
    out.push({
      id: `standalone:food:${food.id}`,
      source: { type: 'standalone' },
      parts: [{ type: 'simple-food', food }],
    })
  }
  return out
}

export function patternToCandidate(pattern: BreakfastPattern): CompositionCandidate {
  return { id: pattern.id, source: pattern.source, parts: pattern.parts }
}

export function rotateBreakfastPattern(
  patterns: readonly BreakfastPattern[],
  recency: RecencyState,
  date: LocalDate,
  mealType: MealType,
): BreakfastPattern[] {
  void mealType
  return [...patterns].sort((a, b) => {
    const penalty =
      recencyPenalty(recency, 'composition', a.id, date) -
      recencyPenalty(recency, 'composition', b.id, date)
    if (penalty !== 0) return penalty
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

export function recipesInPattern(pattern: BreakfastPattern): Recipe[] {
  return pattern.parts.flatMap((part) => (part.type === 'recipe' ? [part.recipe] : []))
}

export function foodsInPattern(pattern: BreakfastPattern): SimpleFood[] {
  return pattern.parts.flatMap((part) => (part.type === 'simple-food' ? [part.food] : []))
}
