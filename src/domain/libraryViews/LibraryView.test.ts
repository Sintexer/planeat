import { describe, expect, it } from 'vitest'
import {
  criteriaForMatching,
  defaultLibraryViewCriteria,
  findStaleLibraryViewRefs,
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
