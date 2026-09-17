import type { CookingEvent } from '../../domain/plans/CookingEvent'
import type { SuggestionCandidate } from '../../domain/plans/componentSuggestions'
import type { Recipe } from '../../domain/recipes/Recipe'
import {
  DISH_TYPE_LABELS,
  type CatalogGroup,
  type CatalogSort,
  type DishType,
  type Effort,
  type MealType,
  type RecipeRole,
} from '../../domain/shared/MealEnums'
import type { Quantity } from '../../domain/shared/Quantity'
import type { SimpleFood } from '../../domain/simpleFoods/SimpleFood'
import type { TagId } from '../../domain/tags/Tag'

export type { CatalogGroup, CatalogSort }

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
  createdAt?: number
  updatedAt?: number
  dishType?: string
  /** Linked catalog ingredient IDs (recipe lines with an id; simple food's ingredient). */
  ingredientIds: string[]
  /** True when a recipe has at least one line with no ingredientId (imported, unlinked). */
  hasUnlinkedIngredients?: boolean
}

export type IngredientFilterOption = {
  id: string
  label: string
  searchText: string
}

export type DishCatalogFilters = {
  query: string
  kind: 'all' | 'recipe' | 'simple-food'
  mealTypes: MealType[]
  roles: RecipeRole[]
  effort: Effort | 'all'
  tagIds: TagId[]
  suggestedOnly: boolean
  maxTotalTimeMinutes: number | ''
  containsIngredientIds: string[]
  excludeIngredientIds: string[]
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
    maxTotalTimeMinutes: '',
    containsIngredientIds: [],
    excludeIngredientIds: [],
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
  const ingredientIds = recipe.ingredientLines
    .map((line) => line.ingredientId)
    .filter((id): id is string => Boolean(id))
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
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt,
    dishType: recipe.dishType,
    ingredientIds,
    hasUnlinkedIngredients: recipe.ingredientLines.some((line) => !line.ingredientId),
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
    createdAt: food.createdAt,
    updatedAt: food.updatedAt,
    ingredientIds: [food.ingredientId],
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
    ingredientIds: [],
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
  if (filters.maxTotalTimeMinutes !== '') {
    if (item.totalTimeMinutes === undefined) return false
    if (item.totalTimeMinutes > filters.maxTotalTimeMinutes) return false
  }
  if (
    filters.containsIngredientIds.length > 0 &&
    !filters.containsIngredientIds.some((id) => item.ingredientIds.includes(id))
  ) {
    return false
  }
  if (
    filters.excludeIngredientIds.length > 0 &&
    filters.excludeIngredientIds.some((id) => item.ingredientIds.includes(id))
  ) {
    return false
  }
  return true
}

function compareForSort(a: DishCatalogItem, b: DishCatalogItem, sort: CatalogSort): number {
  switch (sort) {
    case 'name':
      return a.name.localeCompare(b.name)
    case 'recent-added':
      return (b.createdAt ?? 0) - (a.createdAt ?? 0) || a.name.localeCompare(b.name)
    case 'recent-edited':
      return (b.updatedAt ?? 0) - (a.updatedAt ?? 0) || a.name.localeCompare(b.name)
    case 'shortest-time': {
      const at = a.totalTimeMinutes
      const bt = b.totalTimeMinutes
      if (at === undefined && bt === undefined) return a.name.localeCompare(b.name)
      if (at === undefined) return 1
      if (bt === undefined) return -1
      return at - bt || a.name.localeCompare(b.name)
    }
    case 'relevance':
      return 0
  }
}

/**
 * `'relevance'` is a pass-through: the caller has already produced the right base
 * order (Fuse's ranked order while searching, or the score-desc/name default
 * otherwise) before calling this. Every other mode re-sorts from scratch.
 */
export function sortCatalogItems(items: DishCatalogItem[], sort: CatalogSort): DishCatalogItem[] {
  if (sort === 'relevance' || items.length === 0) return items
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => compareForSort(a.item, b.item, sort) || a.index - b.index)
    .map((entry) => entry.item)
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

export type GroupCatalogItemsOptions = {
  searching: boolean
  /** Meal-picker context (AddComponentFlow): peel off scored items into a Suggested bucket first. */
  suggestedFirst?: boolean
  /** Library-screen context (RecipesScreen): how to bucket the non-suggested remainder. */
  mode?: CatalogGroup
}

function dishTypeGroupLabel(dishType: string): string {
  return DISH_TYPE_LABELS[dishType as DishType] ?? dishType
}

function groupRestByMode(rest: DishCatalogItem[], mode: CatalogGroup): DishCatalogGroup[] {
  if (rest.length === 0) return []

  if (mode === 'kind') {
    const recipes = rest.filter((item) => item.kind === 'recipe')
    const foods = rest.filter((item) => item.kind === 'simple-food')
    const other = rest.filter((item) => item.kind !== 'recipe' && item.kind !== 'simple-food')
    const groups: DishCatalogGroup[] = []
    if (recipes.length > 0) groups.push({ id: 'recipes', title: 'Recipes', items: recipes })
    if (foods.length > 0) groups.push({ id: 'foods', title: 'Simple foods', items: foods })
    if (other.length > 0) groups.push({ id: 'other', title: 'Other', items: other })
    return groups
  }

  if (mode === 'dish-type') {
    const byType = new Map<string, DishCatalogItem[]>()
    const unclassified: DishCatalogItem[] = []
    for (const item of rest) {
      if (item.dishType === undefined) {
        unclassified.push(item)
        continue
      }
      const bucket = byType.get(item.dishType)
      if (bucket) bucket.push(item)
      else byType.set(item.dishType, [item])
    }
    const groups = [...byType.entries()]
      .sort((a, b) => dishTypeGroupLabel(a[0]).localeCompare(dishTypeGroupLabel(b[0])))
      .map(([dishType, groupItems]) => ({
        id: `dish-type:${dishType}`,
        title: dishTypeGroupLabel(dishType),
        items: groupItems,
      }))
    if (unclassified.length > 0) {
      groups.push({ id: 'unclassified', title: 'Unclassified', items: unclassified })
    }
    return groups
  }

  return [{ id: 'all', title: '', items: rest }]
}

export function groupCatalogItems(
  items: DishCatalogItem[],
  options: GroupCatalogItemsOptions,
): DishCatalogGroup[] {
  const { searching, suggestedFirst = false, mode = 'none' } = options
  if (searching || items.length === 0) {
    return items.length === 0 ? [] : [{ id: 'results', title: 'Results', items }]
  }

  if (!suggestedFirst) {
    return groupRestByMode(
      items.filter((item) => item.kind !== 'leftover'),
      mode,
    )
  }

  const suggested = items.filter((item) => item.kind !== 'leftover' && (item.score ?? 0) > 0)
  const suggestedKeys = new Set(suggested.map((item) => item.key))
  const rest = items.filter((item) => !suggestedKeys.has(item.key) && item.kind !== 'leftover')

  const groups: DishCatalogGroup[] = []
  if (suggested.length > 0) {
    groups.push({ id: 'suggested', title: 'Suggested', items: suggested })
  }
  groups.push(...groupRestByMode(rest, mode === 'none' ? 'kind' : mode))
  return groups
}
