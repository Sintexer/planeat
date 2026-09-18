import {
  DEFAULT_CATALOG_GROUP,
  DEFAULT_CATALOG_SORT,
  type CatalogGroup,
  type CatalogSort,
  type Effort,
  type MealType,
  type RecipeRole,
} from '../shared/MealEnums'
import type { TagId } from '../tags/Tag'

export type LibraryViewId = string

export type LibraryViewKind = 'all' | 'recipe' | 'simple-food'
export type LibraryViewEffort = Effort | 'all'

export const LIBRARY_CLEANUP_KINDS = [
  'missing-occasion',
  'missing-dish-type',
  'missing-time',
  'unlinked-ingredients',
] as const

export type LibraryCleanupKind = (typeof LIBRARY_CLEANUP_KINDS)[number]

export const LIBRARY_CLEANUP_LABELS: Record<LibraryCleanupKind, string> = {
  'missing-occasion': 'Missing meal occasion',
  'missing-dish-type': 'Missing dish type',
  'missing-time': 'Missing recorded time',
  'unlinked-ingredients': 'Unlinked ingredient lines',
}

/** Query, filters, sort, grouping, and optional catalog-cleanup view. */
export interface LibraryViewCriteria {
  query: string
  kind: LibraryViewKind
  mealTypes: MealType[]
  roles: RecipeRole[]
  effort: LibraryViewEffort
  tagIds: TagId[]
  maxTotalTimeMinutes: number | ''
  containsIngredientIds: string[]
  excludeIngredientIds: string[]
  sort: CatalogSort
  group: CatalogGroup
  /** Empty / omitted = not a cleanup view. Additive; older saved views omit the field. */
  cleanup?: LibraryCleanupKind | ''
}

export interface LibraryView {
  id: LibraryViewId
  name: string
  criteria: LibraryViewCriteria
  createdAt: number
  updatedAt: number
}

export function defaultLibraryViewCriteria(): LibraryViewCriteria {
  return {
    query: '',
    kind: 'all',
    mealTypes: [],
    roles: [],
    effort: 'all',
    tagIds: [],
    maxTotalTimeMinutes: '',
    containsIngredientIds: [],
    excludeIngredientIds: [],
    sort: DEFAULT_CATALOG_SORT,
    group: DEFAULT_CATALOG_GROUP,
    cleanup: '',
  }
}

function sameSequence(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

export function libraryViewCriteriaEquals(a: LibraryViewCriteria, b: LibraryViewCriteria): boolean {
  return (
    a.query === b.query &&
    a.kind === b.kind &&
    a.effort === b.effort &&
    a.sort === b.sort &&
    a.group === b.group &&
    a.maxTotalTimeMinutes === b.maxTotalTimeMinutes &&
    sameSequence(a.mealTypes, b.mealTypes) &&
    sameSequence(a.roles, b.roles) &&
    sameSequence(a.tagIds, b.tagIds) &&
    sameSequence(a.containsIngredientIds, b.containsIngredientIds) &&
    sameSequence(a.excludeIngredientIds, b.excludeIngredientIds) &&
    (a.cleanup ?? '') === (b.cleanup ?? '')
  )
}

export type StaleLibraryViewRef = {
  field: 'tagIds' | 'containsIngredientIds' | 'excludeIngredientIds'
  id: string
  status: 'archived-tag' | 'missing-tag' | 'missing-ingredient'
}

export function findStaleLibraryViewRefs(
  criteria: LibraryViewCriteria,
  tagsById: ReadonlyMap<TagId, { archived?: boolean }>,
  knownIngredientIds: ReadonlySet<string>,
): StaleLibraryViewRef[] {
  const stale: StaleLibraryViewRef[] = []
  for (const id of criteria.tagIds) {
    const tag = tagsById.get(id)
    if (!tag) {
      stale.push({ field: 'tagIds', id, status: 'missing-tag' })
    } else if (tag.archived === true) {
      stale.push({ field: 'tagIds', id, status: 'archived-tag' })
    }
  }
  for (const id of criteria.containsIngredientIds) {
    if (!knownIngredientIds.has(id)) {
      stale.push({ field: 'containsIngredientIds', id, status: 'missing-ingredient' })
    }
  }
  for (const id of criteria.excludeIngredientIds) {
    if (!knownIngredientIds.has(id)) {
      stale.push({ field: 'excludeIngredientIds', id, status: 'missing-ingredient' })
    }
  }
  return stale
}

/**
 * Drop deleted tag/ingredient ids from matching so a saved view cannot empty
 * the library. Archived tags stay in the criteria — live assignments remain.
 */
export function criteriaForMatching(
  criteria: LibraryViewCriteria,
  stale: readonly StaleLibraryViewRef[],
): LibraryViewCriteria {
  const skipTags = new Set(stale.filter((ref) => ref.status === 'missing-tag').map((ref) => ref.id))
  const skipIngredients = new Set(
    stale.filter((ref) => ref.status === 'missing-ingredient').map((ref) => ref.id),
  )
  if (skipTags.size === 0 && skipIngredients.size === 0) return criteria
  return {
    ...criteria,
    tagIds: criteria.tagIds.filter((id) => !skipTags.has(id)),
    containsIngredientIds: criteria.containsIngredientIds.filter((id) => !skipIngredients.has(id)),
    excludeIngredientIds: criteria.excludeIngredientIds.filter((id) => !skipIngredients.has(id)),
  }
}

export function skipIdsForMatching(stale: readonly StaleLibraryViewRef[]): {
  skipTagIds: Set<TagId>
  skipIngredientIds: Set<string>
} {
  return {
    skipTagIds: new Set(stale.filter((ref) => ref.status === 'missing-tag').map((ref) => ref.id)),
    skipIngredientIds: new Set(
      stale.filter((ref) => ref.status === 'missing-ingredient').map((ref) => ref.id),
    ),
  }
}

export type CleanupCatalogFields = {
  kind: string
  mealTypes: readonly string[]
  dishType?: string
  totalTimeMinutes?: number
  hasUnlinkedIngredients?: boolean
}

/** True when the item belongs in the optional cleanup view (or any view if unset). */
export function itemMatchesCleanup(
  item: CleanupCatalogFields,
  cleanup: LibraryCleanupKind | '' | undefined,
): boolean {
  if (!cleanup) return true
  switch (cleanup) {
    case 'missing-occasion':
      return item.mealTypes.length === 0
    case 'missing-dish-type':
      return item.kind === 'recipe' && !(item.dishType && item.dishType.trim())
    case 'missing-time':
      return item.kind === 'recipe' && item.totalTimeMinutes === undefined
    case 'unlinked-ingredients':
      return item.kind === 'recipe' && item.hasUnlinkedIngredients === true
  }
}
