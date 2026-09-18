import { describe, expect, it } from 'vitest'
import {
  criteriaForMatching,
  defaultLibraryViewCriteria,
  findStaleLibraryViewRefs,
  itemMatchesCleanup,
  libraryViewCriteriaEquals,
} from './LibraryView'

describe('libraryViewCriteriaEquals', () => {
  it('treats identical criteria as equal', () => {
    const a = defaultLibraryViewCriteria()
    const b = defaultLibraryViewCriteria()
    expect(libraryViewCriteriaEquals(a, b)).toBe(true)
  })

  it('detects filter and sort/group changes', () => {
    const base = defaultLibraryViewCriteria()
    expect(libraryViewCriteriaEquals(base, { ...base, query: 'soup' })).toBe(false)
    expect(libraryViewCriteriaEquals(base, { ...base, sort: 'name' })).toBe(false)
    expect(libraryViewCriteriaEquals(base, { ...base, group: 'kind' })).toBe(false)
    expect(libraryViewCriteriaEquals(base, { ...base, tagIds: ['kids'] })).toBe(false)
    expect(libraryViewCriteriaEquals(base, { ...base, cleanup: 'missing-time' })).toBe(false)
    const legacy = { ...base, cleanup: undefined }
    expect(libraryViewCriteriaEquals(base, legacy)).toBe(true)
  })
})

describe('findStaleLibraryViewRefs / criteriaForMatching', () => {
  it('keeps archived tags applied and skips deleted tags so matching is not emptied', () => {
    const criteria = {
      ...defaultLibraryViewCriteria(),
      tagIds: ['live', 'archived', 'gone'],
    }
    const tags = new Map([
      ['live', {}],
      ['archived', { archived: true }],
    ])
    const stale = findStaleLibraryViewRefs(criteria, tags, new Set())
    expect(stale).toEqual([
      { field: 'tagIds', id: 'archived', status: 'archived-tag' },
      { field: 'tagIds', id: 'gone', status: 'missing-tag' },
    ])
    expect(criteriaForMatching(criteria, stale).tagIds).toEqual(['live', 'archived'])
  })

  it('skips missing ingredient ids in contains/exclude', () => {
    const criteria = {
      ...defaultLibraryViewCriteria(),
      containsIngredientIds: ['flour', 'deleted'],
      excludeIngredientIds: ['gone-exclude'],
    }
    const stale = findStaleLibraryViewRefs(criteria, new Map(), new Set(['flour']))
    expect(stale.map((ref) => ref.id).sort()).toEqual(['deleted', 'gone-exclude'])
    const matching = criteriaForMatching(criteria, stale)
    expect(matching.containsIngredientIds).toEqual(['flour'])
    expect(matching.excludeIngredientIds).toEqual([])
  })
})

describe('itemMatchesCleanup', () => {
  const recipe = {
    kind: 'recipe',
    mealTypes: ['dinner'],
    dishType: 'soup',
    totalTimeMinutes: 30,
    hasUnlinkedIngredients: false,
  }

  it('passes every item when cleanup is unset', () => {
    expect(itemMatchesCleanup(recipe, '')).toBe(true)
    expect(itemMatchesCleanup(recipe, undefined)).toBe(true)
  })

  it('finds missing meal occasion on recipes and simple foods', () => {
    expect(itemMatchesCleanup({ ...recipe, mealTypes: [] }, 'missing-occasion')).toBe(true)
    expect(itemMatchesCleanup(recipe, 'missing-occasion')).toBe(false)
    expect(itemMatchesCleanup({ kind: 'simple-food', mealTypes: [] }, 'missing-occasion')).toBe(
      true,
    )
  })

  it('treats missing dish type and recorded time as recipe-only optional gaps', () => {
    expect(itemMatchesCleanup({ ...recipe, dishType: undefined }, 'missing-dish-type')).toBe(true)
    expect(itemMatchesCleanup({ ...recipe, dishType: '  ' }, 'missing-dish-type')).toBe(true)
    expect(itemMatchesCleanup(recipe, 'missing-dish-type')).toBe(false)
    expect(itemMatchesCleanup({ kind: 'simple-food', mealTypes: [] }, 'missing-dish-type')).toBe(
      false,
    )
    expect(itemMatchesCleanup({ ...recipe, totalTimeMinutes: undefined }, 'missing-time')).toBe(
      true,
    )
    expect(itemMatchesCleanup(recipe, 'missing-time')).toBe(false)
    expect(itemMatchesCleanup({ kind: 'simple-food', mealTypes: [] }, 'missing-time')).toBe(false)
  })

  it('finds recipes with unlinked ingredient lines', () => {
    expect(
      itemMatchesCleanup({ ...recipe, hasUnlinkedIngredients: true }, 'unlinked-ingredients'),
    ).toBe(true)
    expect(itemMatchesCleanup(recipe, 'unlinked-ingredients')).toBe(false)
    expect(itemMatchesCleanup({ kind: 'simple-food', mealTypes: [] }, 'unlinked-ingredients')).toBe(
      false,
    )
  })
})
