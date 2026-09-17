import { describe, expect, it } from 'vitest'
import {
  groupCatalogItems,
  itemMatchesFilters,
  sortCatalogItems,
  defaultDishCatalogFilters,
  type DishCatalogItem,
} from './catalogModel'

function makeItem(overrides: Partial<DishCatalogItem> & { key: string }): DishCatalogItem {
  return {
    kind: 'recipe',
    id: overrides.key,
    name: overrides.key,
    roles: [],
    mealTypes: [],
    tags: [],
    tagIds: [],
    subtitle: '',
    ingredientIds: [],
    ...overrides,
  }
}

describe('sortCatalogItems', () => {
  const items = [
    makeItem({ key: 'c', name: 'Carbonara' }),
    makeItem({ key: 'a', name: 'Apple soup' }),
    makeItem({ key: 'b', name: 'Beans' }),
  ]

  it('sorts by name', () => {
    expect(sortCatalogItems(items, 'name').map((item) => item.name)).toEqual([
      'Apple soup',
      'Beans',
      'Carbonara',
    ])
  })

  it('sorts by recently added, descending', () => {
    const withDates = [
      makeItem({ key: 'old', name: 'Old', createdAt: 1 }),
      makeItem({ key: 'new', name: 'New', createdAt: 3 }),
      makeItem({ key: 'mid', name: 'Mid', createdAt: 2 }),
    ]
    expect(sortCatalogItems(withDates, 'recent-added').map((item) => item.key)).toEqual([
      'new',
      'mid',
      'old',
    ])
  })

  it('sorts by recently edited, descending', () => {
    const withDates = [
      makeItem({ key: 'old', name: 'Old', updatedAt: 1 }),
      makeItem({ key: 'new', name: 'New', updatedAt: 3 }),
    ]
    expect(sortCatalogItems(withDates, 'recent-edited').map((item) => item.key)).toEqual([
      'new',
      'old',
    ])
  })

  it('sorts by shortest recorded total time, missing values last', () => {
    const withTimes = [
      makeItem({ key: 'unknown', name: 'Unknown time' }),
      makeItem({ key: 'long', name: 'Long', totalTimeMinutes: 60 }),
      makeItem({ key: 'short', name: 'Short', totalTimeMinutes: 10 }),
    ]
    expect(sortCatalogItems(withTimes, 'shortest-time').map((item) => item.key)).toEqual([
      'short',
      'long',
      'unknown',
    ])
  })

  it('leaves relevance order untouched', () => {
    expect(sortCatalogItems(items, 'relevance')).toEqual(items)
  })
})

describe('groupCatalogItems', () => {
  it('collapses to a single Results bucket while searching, regardless of mode', () => {
    const items = [makeItem({ key: 'a' }), makeItem({ key: 'b' })]
    const groups = groupCatalogItems(items, { searching: true, mode: 'kind' })
    expect(groups).toEqual([{ id: 'results', title: 'Results', items }])
  })

  it('peels off suggested items first and includes every item exactly once', () => {
    const suggested = makeItem({ key: 'suggested', score: 1 })
    const recipe = makeItem({ key: 'recipe', kind: 'recipe' })
    const food = makeItem({ key: 'food', kind: 'simple-food' })
    const groups = groupCatalogItems([suggested, recipe, food], {
      searching: false,
      suggestedFirst: true,
    })
    expect(groups[0]).toEqual({ id: 'suggested', title: 'Suggested', items: [suggested] })
    const allItems = groups.flatMap((group) => group.items)
    expect(allItems.map((item) => item.key).sort()).toEqual(['food', 'recipe', 'suggested'])
  })

  it('groups by item kind', () => {
    const recipe = makeItem({ key: 'recipe', kind: 'recipe' })
    const food = makeItem({ key: 'food', kind: 'simple-food' })
    const groups = groupCatalogItems([recipe, food], { searching: false, mode: 'kind' })
    expect(groups.map((group) => group.title)).toEqual(['Recipes', 'Simple foods'])
  })

  it('groups by primary dish type, with an unclassified bucket last', () => {
    const soup = makeItem({ key: 'soup', dishType: 'soup' })
    const custom = makeItem({ key: 'custom', dishType: 'grandmas-secret' })
    const plain = makeItem({ key: 'plain' })
    const groups = groupCatalogItems([soup, custom, plain], { searching: false, mode: 'dish-type' })
    expect(groups.map((group) => group.title)).toEqual(['grandmas-secret', 'Soup', 'Unclassified'])
    expect(groups.at(-1)).toEqual({ id: 'unclassified', title: 'Unclassified', items: [plain] })
  })
})

describe('itemMatchesFilters', () => {
  const base = defaultDishCatalogFilters()

  it('keeps a 10-minute recipe under max 20 and drops missing time', () => {
    const timed = makeItem({ key: 'fast', totalTimeMinutes: 10 })
    const missing = makeItem({ key: 'unknown' })
    expect(itemMatchesFilters(timed, { ...base, maxTotalTimeMinutes: 20 })).toBe(true)
    expect(itemMatchesFilters(missing, { ...base, maxTotalTimeMinutes: 20 })).toBe(false)
  })

  it('contains matches linked ingredient IDs, not unlinked-only lines', () => {
    const withFlour = makeItem({ key: 'bread', ingredientIds: ['flour'] })
    const unlinked = makeItem({
      key: 'import',
      ingredientIds: [],
      hasUnlinkedIngredients: true,
    })
    expect(itemMatchesFilters(withFlour, { ...base, containsIngredientIds: ['flour'] })).toBe(true)
    expect(itemMatchesFilters(unlinked, { ...base, containsIngredientIds: ['flour'] })).toBe(false)
  })

  it('exclude drops a recipe listing that ID; unlinked-only still matches', () => {
    const withOnion = makeItem({ key: 'soup', ingredientIds: ['onion'] })
    const unlinked = makeItem({
      key: 'import',
      ingredientIds: [],
      hasUnlinkedIngredients: true,
    })
    expect(itemMatchesFilters(withOnion, { ...base, excludeIngredientIds: ['onion'] })).toBe(false)
    expect(itemMatchesFilters(unlinked, { ...base, excludeIngredientIds: ['onion'] })).toBe(true)
  })

  it('does not use query inside itemMatchesFilters', () => {
    const item = makeItem({ key: 'pasta', name: 'Pasta' })
    expect(itemMatchesFilters(item, { ...base, query: 'zzzz-no-match' })).toBe(true)
  })
})
