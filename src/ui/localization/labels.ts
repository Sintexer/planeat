import {
  CATALOG_GROUPS,
  CATALOG_SORTS,
  DISH_TYPES,
  EFFORT_LEVELS,
  MEAL_TYPES,
  RECIPE_ROLES,
  REUSE_POLICIES,
  type CatalogGroup,
  type CatalogSort,
  type Effort,
  type RecipeRole,
  type ReusePolicy,
} from '../../domain/shared/MealEnums'
import type { LibraryCleanupKind } from '../../domain/libraryViews/LibraryView'
import { SHOPPING_SECTIONS, type ShoppingSection } from '../../domain/groceries/shoppingSections'
import { UNIT_REGISTRY } from '../../domain/shared/UnitRegistry'
import type { MessageId } from './messages'
import type { Translate } from './t'

export function mealTypeLabel(t: Translate, mealType: string): string {
  const id = `mealType.${mealType}` as MessageId
  return mealType in { breakfast: 1, lunch: 1, dinner: 1 } ? t(id) : mealType
}

export function roleLabel(t: Translate, role: RecipeRole): string {
  return t(`role.${role}` as MessageId)
}

export function roleChipLabel(t: Translate, role: RecipeRole): string {
  return t(`roleChip.${role}` as MessageId)
}

export function effortLabel(t: Translate, effort: Effort): string {
  return t(`effort.${effort}` as MessageId)
}

export function reuseLabel(t: Translate, policy: ReusePolicy): string {
  return t(`reuse.${policy}` as MessageId)
}

export function dishTypeLabel(t: Translate, dishType: string): string {
  if ((DISH_TYPES as readonly string[]).includes(dishType)) {
    return t(`dishType.${dishType}` as MessageId)
  }
  return dishType
}

export function catalogSortLabel(t: Translate, sort: CatalogSort): string {
  return t(`sort.${sort}` as MessageId)
}

export function catalogGroupLabel(t: Translate, group: CatalogGroup): string {
  return t(`group.${group}` as MessageId)
}

export function cleanupLabel(t: Translate, kind: LibraryCleanupKind): string {
  return t(`cleanup.${kind}` as MessageId)
}

export function shoppingSectionLabel(t: Translate, key: string): string {
  if ((SHOPPING_SECTIONS as readonly string[]).includes(key)) {
    return t(`section.${key}` as MessageId)
  }
  return key
}

export function unitDisplayLabel(t: Translate, unit: string): string {
  const known = UNIT_REGISTRY.some((definition) => definition.key === unit)
  return known ? t(`unit.${unit}` as MessageId) : unit
}

export function unitShortDisplay(t: Translate, unit: string): string {
  const known = UNIT_REGISTRY.some((definition) => definition.key === unit)
  return known ? t(`unitShort.${unit}` as MessageId) : unit
}

export function mealTypeOptions(t: Translate) {
  return MEAL_TYPES.map((value) => ({ value, label: mealTypeLabel(t, value) }))
}

export function roleOptions(t: Translate) {
  return RECIPE_ROLES.map((value) => ({ value, label: roleLabel(t, value) }))
}

export function effortOptions(t: Translate) {
  return EFFORT_LEVELS.map((value) => ({ value, label: effortLabel(t, value) }))
}

export function dishTypeOptions(t: Translate) {
  return DISH_TYPES.map((value) => ({ value, label: dishTypeLabel(t, value) }))
}

export function catalogSortOptions(t: Translate) {
  return CATALOG_SORTS.map((value) => ({ value, label: catalogSortLabel(t, value) }))
}

export function catalogGroupOptions(t: Translate) {
  return CATALOG_GROUPS.map((value) => ({ value, label: catalogGroupLabel(t, value) }))
}

export function reuseOptions(t: Translate) {
  return REUSE_POLICIES.map((value) => ({ value, label: reuseLabel(t, value) }))
}

export function shoppingSectionOptions(t: Translate, current?: string) {
  const options = SHOPPING_SECTIONS.map((section: ShoppingSection) => ({
    value: section,
    label: shoppingSectionLabel(t, section),
  }))
  const extra = current?.trim()
  if (extra && !(SHOPPING_SECTIONS as readonly string[]).includes(extra)) {
    return [...options, { value: extra, label: extra }]
  }
  return options
}

export function kindLabel(t: Translate, kind: 'recipe' | 'simple-food'): string {
  return kind === 'recipe' ? t('kind.recipe') : t('kind.simpleFood')
}

export function catalogGroupHeading(t: Translate, groupId: string, dishType?: string): string {
  if (groupId === 'recipes') return t('kind.recipes')
  if (groupId === 'foods') return t('kind.simpleFoods')
  if (groupId === 'other') return t('catalog.group.other')
  if (groupId === 'unclassified') return t('catalog.group.unclassified')
  if (groupId === 'results') return t('catalog.group.results')
  if (groupId === 'pairings') return t('catalog.group.pairings')
  if (groupId === 'from-favorites') return t('catalog.group.fromFavorites')
  if (groupId === 'suitable') return t('catalog.group.suitable')
  if (groupId === 'suggested') return t('catalog.group.suggested')
  if (groupId === 'all') return t('catalog.group.allItems')
  if (groupId.startsWith('dish-type:')) {
    return dishTypeLabel(t, groupId.slice('dish-type:'.length))
  }
  return dishType ?? ''
}
