import type { CookingEvent } from '../../domain/plans/CookingEvent'
import type { SuggestionCandidate } from '../../domain/plans/componentSuggestions'
import type { Recipe } from '../../domain/recipes/Recipe'
import type { Effort, MealType, RecipeRole } from '../../domain/shared/MealEnums'
import type { Quantity } from '../../domain/shared/Quantity'
import type { SimpleFood } from '../../domain/simpleFoods/SimpleFood'

export type DishCatalogKind = 'recipe' | 'simple-food' | 'leftover'

export type DishCatalogItem = {
  key: string
  kind: DishCatalogKind
  id: string
  name: string
  photoUrl?: string
  roles: RecipeRole[]
  mealTypes: MealType[]
  tags: string[]
  effort?: Effort
  subtitle: string
  remaining?: Quantity
  recipeId?: string
  cookingEvent?: CookingEvent
  score?: number
  reason?: SuggestionCandidate['reason']
  /** Set when a leftover exists but can't be used on the target day (e.g. same-day-only recipe). */
  ineligibleReason?: string
  activeTimeMinutes?: number
  totalTimeMinutes?: number
}

export type DishCatalogFilters = {
  query: string
  kind: 'all' | 'recipe' | 'simple-food'
  mealType: MealType | 'all'
  role: RecipeRole | 'all'
  effort: Effort | 'all'
  tag: string | null
  suggestedOnly: boolean
}

export function defaultDishCatalogFilters(
  mealType: MealType | 'all' = 'all',
  suggestedOnly = false,
): DishCatalogFilters {
  return {
    query: '',
    kind: 'all',
    mealType,
    role: 'all',
    effort: 'all',
    tag: null,
    suggestedOnly,
  }
}

export function recipeToCatalogItem(
  recipe: Recipe,
  extra?: Partial<Pick<DishCatalogItem, 'score' | 'reason' | 'subtitle'>>,
): DishCatalogItem {
  return {
    key: `recipe:${recipe.id}`,
    kind: 'recipe',
    id: recipe.id,
    name: recipe.name,
    photoUrl: recipe.photoUrl,
    roles: recipe.roles,
    mealTypes: recipe.mealTypes,
    tags: recipe.tags,
    effort: recipe.effort,
    subtitle: extra?.subtitle ?? 'Recipe',
    score: extra?.score,
    reason: extra?.reason,
    activeTimeMinutes: recipe.activeTimeMinutes,
    totalTimeMinutes: recipe.totalTimeMinutes,
  }
}

export function simpleFoodToCatalogItem(
  food: SimpleFood,
  extra?: Partial<Pick<DishCatalogItem, 'score' | 'reason' | 'subtitle'>>,
): DishCatalogItem {
  return {
    key: `simple-food:${food.id}`,
    kind: 'simple-food',
    id: food.id,
    name: food.name,
    roles: food.roles,
    mealTypes: food.mealTypes,
    tags: food.tags,
    subtitle: extra?.subtitle ?? 'Simple food',
    score: extra?.score,
    reason: extra?.reason,
  }
}

export function leftoverToCatalogItem(
  event: CookingEvent,
  remaining: Quantity,
  ineligibleReason?: string,
): DishCatalogItem {
  const recipe = event.recipeSnapshot
  return {
    key: `leftover:${event.id}`,
    kind: 'leftover',
    id: event.id,
    name: recipe.name,
    photoUrl: recipe.photoUrl,
    roles: recipe.roles,
    mealTypes: recipe.mealTypes,
    tags: recipe.tags,
    effort: recipe.effort,
    remaining,
    recipeId: event.recipeId,
    cookingEvent: event,
    subtitle: 'Remaining prep',
    ineligibleReason,
  }
}

export function itemMatchesFilters(item: DishCatalogItem, filters: DishCatalogFilters): boolean {
  if (item.kind === 'leftover') return true
  if (filters.kind !== 'all' && item.kind !== filters.kind) return false
  if (filters.mealType !== 'all' && !item.mealTypes.includes(filters.mealType)) return false
  if (filters.role !== 'all' && !item.roles.includes(filters.role)) return false
  if (filters.effort !== 'all' && item.effort !== filters.effort) return false
  if (filters.tag && !item.tags.some((tag) => tag.toLowerCase() === filters.tag?.toLowerCase())) {
    return false
  }
  if (filters.suggestedOnly && !(item.score && item.score > 0)) return false
  return true
}

export function uniqueTags(items: DishCatalogItem[], limit = 8): string[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    for (const tag of item.tags) {
      const key = tag.trim()
      if (!key) continue
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag]) => tag)
}

export type DishCatalogGroup = { id: string; title: string; items: DishCatalogItem[] }

export function groupCatalogItems(
  items: DishCatalogItem[],
  searching: boolean,
): DishCatalogGroup[] {
  if (searching || items.length === 0) {
    return items.length === 0 ? [] : [{ id: 'results', title: 'Results', items }]
  }

  const suggested = items.filter((item) => item.kind !== 'leftover' && (item.score ?? 0) > 0)
  const suggestedKeys = new Set(suggested.map((item) => item.key))
  const rest = items.filter((item) => !suggestedKeys.has(item.key) && item.kind !== 'leftover')

  const groups: DishCatalogGroup[] = []
  if (suggested.length > 0) {
    groups.push({ id: 'suggested', title: 'Suggested', items: suggested })
  }

  const recipes = rest.filter((item) => item.kind === 'recipe')
  const foods = rest.filter((item) => item.kind === 'simple-food')
  if (recipes.length > 0) groups.push({ id: 'recipes', title: 'Recipes', items: recipes })
  if (foods.length > 0) groups.push({ id: 'foods', title: 'Simple foods', items: foods })
  return groups
}
