import { describe, expect, it } from 'vitest'
import {
  catalogRowTagLabels,
  groupCatalogItems,
  itemMatchesFilters,
  sortCatalogItems,
  uniqueTagFacets,
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
    expect(groups).toEqual([{ id: 'results', title: '', items }])
  })

  it('peels off suggested items first and includes every item exactly once', () => {
    const suggested = makeItem({ key: 'suggested', score: 1 })
    const recipe = makeItem({ key: 'recipe', kind: 'recipe' })
    const food = makeItem({ key: 'food', kind: 'simple-food' })
    const groups = groupCatalogItems([suggested, recipe, food], {
      searching: false,
      suggestedFirst: true,
    })
    expect(groups[0]).toEqual({ id: 'suggested', title: '', items: [suggested] })
    const allItems = groups.flatMap((group) => group.items)
    expect(allItems.map((item) => item.key).sort()).toEqual(['food', 'recipe', 'suggested'])
  })

  it('groups by item kind', () => {
    const recipe = makeItem({ key: 'recipe', kind: 'recipe' })
    const food = makeItem({ key: 'food', kind: 'simple-food' })
    const groups = groupCatalogItems([recipe, food], { searching: false, mode: 'kind' })
    expect(groups.map((group) => group.id)).toEqual(['recipes', 'foods'])
  })

  it('groups by primary dish type, with an unclassified bucket last', () => {
    const soup = makeItem({ key: 'soup', dishType: 'soup' })
    const custom = makeItem({ key: 'custom', dishType: 'grandmas-secret' })
    const plain = makeItem({ key: 'plain' })
    const groups = groupCatalogItems([soup, custom, plain], { searching: false, mode: 'dish-type' })
    expect(groups.map((group) => group.id)).toEqual([
      'dish-type:grandmas-secret',
      'dish-type:soup',
      'unclassified',
    ])
    expect(groups.at(-1)).toEqual({ id: 'unclassified', title: '', items: [plain] })
  })

  it('groups picker sections without dropping unmatched items from All items', () => {
    const pairing = makeItem({ key: 'rice', reason: 'pairing' })
    const favorite = makeItem({ key: 'yogurt', reason: 'favorite' })
    const suitable = makeItem({ key: 'salad', reason: 'role' })
    const otherOccasion = makeItem({
      key: 'oats',
      reason: 'other',
      mealTypes: ['breakfast'],
    })
    const groups = groupCatalogItems([pairing, favorite, suitable, otherOccasion], {
      searching: false,
      suggestedFirst: true,
      pickerSections: true,
    })
    expect(groups.map((group) => group.id)).toEqual([
      'pairings',
      'from-favorites',
      'suitable',
      'all',
    ])
    expect(groups.find((group) => group.id === 'all')?.items.map((item) => item.key)).toEqual([
      'oats',
    ])
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

  it('applies cleanup views without treating gaps as hard filter errors elsewhere', () => {
    const complete = makeItem({
      key: 'complete',
      mealTypes: ['dinner'],
      dishType: 'soup',
      totalTimeMinutes: 20,
    })
    const noOccasion = makeItem({ key: 'plain', mealTypes: [] })
    const noType = makeItem({ key: 'no-type', mealTypes: ['dinner'] })
    const unlinked = makeItem({
      key: 'import',
      mealTypes: ['dinner'],
      dishType: 'soup',
      totalTimeMinutes: 10,
      hasUnlinkedIngredients: true,
    })
    const food = makeItem({ key: 'yogurt', kind: 'simple-food', mealTypes: [] })
    expect(itemMatchesFilters(noOccasion, { ...base, cleanup: 'missing-occasion' })).toBe(true)
    expect(itemMatchesFilters(complete, { ...base, cleanup: 'missing-occasion' })).toBe(false)
    expect(itemMatchesFilters(food, { ...base, cleanup: 'missing-occasion' })).toBe(true)
    expect(itemMatchesFilters(noType, { ...base, cleanup: 'missing-dish-type' })).toBe(true)
    expect(itemMatchesFilters(food, { ...base, cleanup: 'missing-dish-type' })).toBe(false)
    expect(itemMatchesFilters(noType, { ...base, cleanup: 'missing-time' })).toBe(true)
    expect(itemMatchesFilters(complete, { ...base, cleanup: 'missing-time' })).toBe(false)
    expect(itemMatchesFilters(unlinked, { ...base, cleanup: 'unlinked-ingredients' })).toBe(true)
    expect(itemMatchesFilters(complete, { ...base, cleanup: 'unlinked-ingredients' })).toBe(false)
  })

  it('still matches a tag filter when the live item keeps an archived or dangling tagId', () => {
    const item = makeItem({ key: 'soup', tagIds: ['archived-or-gone'] })
    expect(itemMatchesFilters(item, { ...base, tagIds: ['archived-or-gone'] })).toBe(true)
    expect(itemMatchesFilters(item, { ...base, tagIds: ['other'] })).toBe(false)
  })

  it('skips missing tag ids so a deleted-tag filter does not empty the library', () => {
    const pasta = makeItem({ key: 'pasta', tagIds: ['kids'] })
    const filters = { ...base, tagIds: ['deleted', 'kids'] }
    expect(itemMatchesFilters(pasta, filters)).toBe(true)
    expect(itemMatchesFilters(pasta, filters, { skipTagIds: new Set(['deleted']) })).toBe(true)
    expect(
      itemMatchesFilters(
        pasta,
        { ...base, tagIds: ['deleted'] },
        { skipTagIds: new Set(['deleted']) },
      ),
    ).toBe(true)
  })
})

describe('uniqueTagFacets', () => {
  it('omits archived ids from the default list and keeps applied filters visible', () => {
    const items = [
      makeItem({ key: 'a', tagIds: ['live', 'archived'] }),
      makeItem({ key: 'b', tagIds: ['live'] }),
    ]
    const names = new Map([
      ['live', 'soup'],
      ['archived', 'batch'],
    ])
    expect(
      uniqueTagFacets(items, names, {
        excludeIds: new Set(['archived']),
        retainIds: ['archived', 'missing'],
      }),
    ).toEqual([
      { id: 'live', name: 'soup' },
      { id: 'archived', name: 'batch' },
      { id: 'missing', name: '' },
    ])
  })
})

describe('catalogRowTagLabels', () => {
  it('skips tags that duplicate a shown role label', () => {
    expect(catalogRowTagLabels(['Side', 'Italian', 'Pasta'], ['SIDE', 'vegetable'])).toEqual([
      'Italian',
      'Pasta',
    ])
  })

  it('caps at two tags', () => {
    expect(catalogRowTagLabels(['a', 'b', 'c'], [])).toEqual(['a', 'b'])
  })
})
