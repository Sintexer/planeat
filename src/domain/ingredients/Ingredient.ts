import type { UiLocale } from '../shared/Locale'

export type IngredientId = string

/**
 * A preferred display label for one locale. `locale` is a plain string, not
 * `UiLocale` — like `Recipe.dishType`, a value outside the current build's
 * locale list (legacy, future, hand-edited) must always round-trip rather
 * than being rejected or coerced.
 */
export interface IngredientLabel {
  locale: string
  label: string
}

/** A locale-scoped alias, distinct from the legacy/unclassified `aliases` bucket. */
export interface LocalizedAlias {
  locale: string
  text: string
}

export interface Ingredient {
  id: IngredientId
  name: string
  /** Legacy/unclassified aliases. Never reinterpreted or assigned a locale during migration. */
  aliases: string[]
  /** Locale-scoped preferred labels. Empty/absent = fall back to `name` for every locale. */
  preferredLabels?: IngredientLabel[]
  /** Locale-scoped aliases, additive alongside the untouched legacy `aliases` bucket. */
  localizedAliases?: LocalizedAlias[]
  category?: string
  /** Optional shopping-section key (produce, pantry, …). Unset lines group under Other. */
  shoppingSection?: string
  isCommon: boolean
  createdAt: number
  updatedAt: number
}

export function normalizeIngredientName(name: string): string {
  return name.trim().toLowerCase()
}

/**
 * Identity match used for collision checks and basic lookup: `name`, legacy
 * `aliases`, and `localizedAliases`. Deliberately excludes `preferredLabels` —
 * two different ingredients may legitimately share a preferred-label word;
 * that ambiguity is resolved via candidate selection at link time
 * (`ingredientMatchesAnyIdentifier`/`findCandidatesByName`), never blocked here.
 */
export function ingredientMatchesName(ingredient: Ingredient, rawName: string): boolean {
  const needle = normalizeIngredientName(rawName)
  if (!needle) return false
  if (normalizeIngredientName(ingredient.name) === needle) return true
  if (ingredient.aliases.some((alias) => normalizeIngredientName(alias) === needle)) return true
  return (ingredient.localizedAliases ?? []).some(
    (alias) => normalizeIngredientName(alias.text) === needle,
  )
}

/**
 * Broader identity match used only for candidate search when linking a typed
 * name to an ingredient (`findCandidatesByName`) — adds `preferredLabels` on
 * top of `ingredientMatchesName`. Never used for collision checks.
 */
export function ingredientMatchesAnyIdentifier(ingredient: Ingredient, rawName: string): boolean {
  if (ingredientMatchesName(ingredient, rawName)) return true
  const needle = normalizeIngredientName(rawName)
  if (!needle) return false
  return (ingredient.preferredLabels ?? []).some(
    (entry) => normalizeIngredientName(entry.label) === needle,
  )
}

/** The label to display for `locale`: the matching preferred label, or `name` as the default fallback. */
export function resolveIngredientLabel(ingredient: Ingredient, locale: UiLocale): string {
  const match = ingredient.preferredLabels?.find((entry) => entry.locale === locale)
  return match?.label.trim() || ingredient.name
}

/** Merge missing locale-label/alias fields onto a stored ingredient row (e.g. from an older backup). */
export function mergeIngredientDefaults(row: Ingredient): Ingredient {
  return {
    ...row,
    preferredLabels: row.preferredLabels ?? [],
    localizedAliases: row.localizedAliases ?? [],
  }
}
