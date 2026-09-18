import { describe, expect, it } from 'vitest'
import type { Recipe } from '../../recipes/Recipe'
import {
  compareScoredCandidates,
  compareWeekObjectives,
  DEFAULT_GENERATION_SOFT_PREFS,
  scoreReasonsForPick,
  selectBestCandidate,
  type ScoringContext,
} from './scoring'

function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'a-demanding',
    name: 'Stew',
    yield: { value: 4, unit: 'serving' },
    defaultPortionPerPerson: { value: 1, unit: 'serving' },
    ingredientLines: [],
    instructions: '',
    roles: ['complete'],
    mealTypes: ['dinner'],
    effort: 'demanding',
    reusePolicy: 'batch-friendly',
    freezerFriendly: false,
    tagIds: [],
    totalTimeMinutes: 60,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

function context(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return {
    date: '2026-01-07',
    mealType: 'dinner',
    prefs: DEFAULT_GENERATION_SOFT_PREFS,
    weekRecipeIds: [],
    previousWeekRecipeIds: [],
    demandingCooksOnDate: 0,
    cookingEventCountOnDate: 0,
    tagNamesById: {},
    ...overrides,
  }
}

describe('compareScoredCandidates', () => {
  it('prefers quick effort on a quick-meal day', () => {
    const demanding = recipe({ id: 'aaa', effort: 'demanding', totalTimeMinutes: 20 })
    const quick = recipe({ id: 'zzz', name: 'Eggs', effort: 'quick', totalTimeMinutes: 15 })
    const ctx = context({
      prefs: { ...DEFAULT_GENERATION_SOFT_PREFS, quickMealsOnlyDays: [3] },
    })
    expect(compareScoredCandidates(quick, demanding, ctx)).toBeLessThan(0)
    expect(selectBestCandidate([demanding, quick], ctx)?.recipe.id).toBe('zzz')
    expect(
      scoreReasonsForPick(quick, [demanding, quick], ctx).some((row) => row.code === 'quick-day'),
    ).toBe(true)
  })

  it('does not treat missing time as the fastest', () => {
    const untimed = recipe({ id: 'fast-looking', effort: 'regular', totalTimeMinutes: undefined })
    const timed = recipe({ id: 'known', name: 'Known', effort: 'regular', totalTimeMinutes: 40 })
    const ctx = context()
    expect(selectBestCandidate([untimed, timed], ctx)?.recipe.id).toBe('known')
  })

  it('penalizes repeating a fixed Monday recipe when an alternative exists', () => {
    const soup = recipe({ id: 'soup', name: 'Soup', effort: 'regular' })
    const stew = recipe({ id: 'stew', name: 'Stew', effort: 'regular' })
    const ctx = context({
      date: '2026-01-08',
      mealType: 'lunch',
      weekRecipeIds: ['soup'],
    })
    expect(selectBestCandidate([soup, stew], ctx)?.recipe.id).toBe('stew')
    expect(
      scoreReasonsForPick(stew, [soup, stew], ctx).some(
        (row) => row.code === 'repetition' && row.source === 'this-week',
      ),
    ).toBe(true)
  })

  it('labels previous-week ids as planned history', () => {
    const soup = recipe({ id: 'soup', name: 'Soup', effort: 'regular' })
    const stew = recipe({ id: 'stew', name: 'Stew', effort: 'regular' })
    const ctx = context({ previousWeekRecipeIds: ['soup'] })
    expect(selectBestCandidate([soup, stew], ctx)?.recipe.id).toBe('stew')
    expect(
      scoreReasonsForPick(stew, [soup, stew], ctx).some(
        (row) => row.code === 'planned-history' && row.source === 'planned-history',
      ),
    ).toBe(true)
  })

  it('never ranks an empty slot above an eligible recipe', () => {
    const only = recipe({ id: 'only', effort: 'demanding' })
    expect(selectBestCandidate([only], context())?.recipe.id).toBe('only')
    expect(selectBestCandidate([], context())).toBeUndefined()
  })
})

describe('compareWeekObjectives', () => {
  it('ranks coverage above preference penalties', () => {
    expect(
      compareWeekObjectives({ coverage: 2, penalties: [9, 9] }, { coverage: 1, penalties: [0, 0] }),
    ).toBeLessThan(0)
  })
})
