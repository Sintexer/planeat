import type { GroceryItem } from './GroceryItem'

/**
 * Curated shopping-section keys for selects and grouped grocery views.
 * Stored values stay a plain optional string so an unrecognized key
 * (legacy, hand-edited, future) always round-trips.
 */
export const SHOPPING_SECTIONS = [
  'produce',
  'bakery',
  'chilled',
  'pantry',
  'frozen',
  'other',
] as const

export type ShoppingSection = (typeof SHOPPING_SECTIONS)[number]

export const FALLBACK_SHOPPING_SECTION: ShoppingSection = 'other'

export const SHOPPING_SECTION_LABELS: Record<ShoppingSection, string> = {
  produce: 'Produce',
  bakery: 'Bakery',
  chilled: 'Chilled',
  pantry: 'Pantry',
  frozen: 'Frozen',
  other: 'Other',
}

const STARTER_SECTION_SET = new Set<string>(SHOPPING_SECTIONS)

export function normalizeShoppingSection(value?: string | null): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}

/** Grouping key: missing/blank section lands in Other. Explicit `other` does too. */
export function shoppingSectionGroupKey(value?: string | null): string {
  return normalizeShoppingSection(value) ?? FALLBACK_SHOPPING_SECTION
}

export function shoppingSectionLabel(key: string): string {
  return SHOPPING_SECTION_LABELS[key as ShoppingSection] ?? key
}

export function shoppingSectionSelectOptions(current?: string): { value: string; label: string }[] {
  const options = SHOPPING_SECTIONS.map((section) => ({
    value: section,
    label: SHOPPING_SECTION_LABELS[section],
  }))
  const extra = normalizeShoppingSection(current)
  if (extra && !STARTER_SECTION_SET.has(extra)) {
    return [...options, { value: extra, label: extra }]
  }
  return options
}

export type GrocerySectionGroup = {
  key: string
  items: GroceryItem[]
}

export type GroceryListView =
  { mode: 'flat'; items: GroceryItem[] } | { mode: 'grouped'; groups: GrocerySectionGroup[] }

function sortByLabel(items: GroceryItem[]): GroceryItem[] {
  return [...items].sort((a, b) => a.label.localeCompare(b.label))
}

function groupBySection(items: GroceryItem[]): GrocerySectionGroup[] {
  const buckets = new Map<string, GroceryItem[]>()
  for (const item of items) {
    const key = shoppingSectionGroupKey(item.shoppingSection)
    const bucket = buckets.get(key)
    if (bucket) bucket.push(item)
    else buckets.set(key, [item])
  }

  const groups: GrocerySectionGroup[] = []
  for (const key of SHOPPING_SECTIONS) {
    if (key === FALLBACK_SHOPPING_SECTION) continue
    const grouped = buckets.get(key)
    if (grouped && grouped.length > 0) groups.push({ key, items: grouped })
  }

  const unknownKeys = [...buckets.keys()]
    .filter((key) => !STARTER_SECTION_SET.has(key))
    .sort((a, b) => shoppingSectionLabel(a).localeCompare(shoppingSectionLabel(b)))
  for (const key of unknownKeys) {
    const grouped = buckets.get(key)
    if (grouped && grouped.length > 0) groups.push({ key, items: grouped })
  }

  const other = buckets.get(FALLBACK_SHOPPING_SECTION)
  if (other && other.length > 0) {
    groups.push({ key: FALLBACK_SHOPPING_SECTION, items: other })
  }
  return groups
}

/**
 * Display order is by label (and section, when grouped) — never by checked.
 * Checking an item must not move it relative to neighbors.
 */
export function groceryListView(
  items: GroceryItem[],
  options: { hideChecked: boolean; grouped: boolean },
): GroceryListView {
  const visible = options.hideChecked ? items.filter((item) => !item.checked) : items
  const sorted = sortByLabel(visible)
  if (!options.grouped) return { mode: 'flat', items: sorted }
  return { mode: 'grouped', groups: groupBySection(sorted) }
}

/**
 * Generated lines that share a catalog ingredient stay together so grams and
 * pieces (or a known amount plus unspecified) read as one shopping item.
 */
export function clusterGroceryItems(items: GroceryItem[]): GroceryItem[][] {
  const clusters = new Map<string, GroceryItem[]>()
  const order: string[] = []
  for (const item of items) {
    const key =
      item.origin === 'generated' && item.ingredientId
        ? `ing:${item.ingredientId}`
        : `row:${item.id}`
    const existing = clusters.get(key)
    if (existing) {
      existing.push(item)
      continue
    }
    clusters.set(key, [item])
    order.push(key)
  }
  return order.map((key) => clusters.get(key)!)
}
