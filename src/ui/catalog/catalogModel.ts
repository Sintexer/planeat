import type { CookingEvent } from '../../domain/plans/CookingEvent'
import type { SuggestionCandidate } from '../../domain/plans/componentSuggestions'
import type { Recipe } from '../../domain/recipes/Recipe'
import type { Effort, MealType, RecipeRole } from '../../domain/shared/MealEnums'
import type { Quantity } from '../../domain/shared/Quantity'
import type { SimpleFood } from '../../domain/simpleFoods/SimpleFood'
import type { TagId } from '../../domain/tags/Tag'

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
  tagIds: TagId[]
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
  mealTypes: MealType[]
  roles: RecipeRole[]
  effort: Effort | 'all'
  tagIds: TagId[]
  suggestedOnly: boolean
}

export function defaultDishCatalogFilters(
  mealType: MealType | 'all' = 'all',
  suggestedOnly = false,
): DishCatalogFilters {
  return {
    query: '',
    kind: 'all',
    mealTypes: mealType === 'all' ? [] : [mealType],
    roles: [],
    effort: 'all',
    tagIds: [],
    suggestedOnly,
  }
}

function resolveTagNames(tagIds: TagId[], tagNamesById: Map<TagId, string>): string[] {
  return tagIds
    .map((id) => tagNamesById.get(id))
    .filter((name): name is string => name !== undefined)
}

export function recipeToCatalogItem(
  recipe: Recipe,
  tagNamesById: Map<TagId, string>,
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
    tags: resolveTagNames(recipe.tagIds, tagNamesById),
    tagIds: recipe.tagIds,
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
  tagNamesById: Map<TagId, string>,
  extra?: Partial<Pick<DishCatalogItem, 'score' | 'reason' | 'subtitle'>>,
): DishCatalogItem {
  return {
    key: `simple-food:${food.id}`,
    kind: 'simple-food',
    id: food.id,
    name: food.name,
    roles: food.roles,
    mealTypes: food.mealTypes,
    tags: resolveTagNames(food.tagIds, tagNamesById),
    tagIds: food.tagIds,
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
    tagIds: [],
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
  if (
    filters.mealTypes.length > 0 &&
    !filters.mealTypes.some((mealType) => item.mealTypes.includes(mealType))
  ) {
    return false
  }
  if (filters.roles.length > 0 && !filters.roles.some((role) => item.roles.includes(role))) {
    return false
  }
  if (filters.effort !== 'all' && item.effort !== filters.effort) return false
  if (filters.tagIds.length > 0 && !filters.tagIds.some((id) => item.tagIds.includes(id))) {
    return false
  }
  if (filters.suggestedOnly && !(item.score && item.score > 0)) return false
  return true
}

export type TagFacet = { id: TagId; name: string }

export function uniqueTagFacets(
  items: DishCatalogItem[],
  tagNamesById: Map<TagId, string>,
  limit = 8,
): TagFacet[] {
  const counts = new Map<TagId, number>()
  for (const item of items) {
    for (const id of item.tagIds) {
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, name: tagNamesById.get(id), count }))
    .filter(
      (entry): entry is { id: TagId; name: string; count: number } => entry.name !== undefined,
    )
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ id, name }) => ({ id, name }))
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
