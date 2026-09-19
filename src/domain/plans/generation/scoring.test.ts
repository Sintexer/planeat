import { describe, expect, it } from 'vitest'
import type { Recipe } from '../../recipes/Recipe'
import type { SimpleFood } from '../../simpleFoods/SimpleFood'
import { emptyRecency, rememberUse } from './recency'
import {
  compareScoreTuples,
  compareScoredCandidates,
  compareWeekObjectives,
  compositionScoreTuple,
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
    weekFoodIds: [],
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

describe('compositionScoreTuple', () => {
  it('ranks a cooked recipe above a standalone simple food', () => {
    const soup = recipe({ id: 'soup', effort: 'regular' })
    const bread: SimpleFood = {
      id: 'bread',
      ingredientId: 'ing-bread',
      name: 'Bread',
      defaultPortion: { value: 2, unit: 'piece' },
      roles: ['side'],
      mealTypes: ['dinner'],
      tagIds: [],
      enabledInSuggestions: true,
      createdAt: 0,
      updatedAt: 0,
    }
    const ctx = context()
    const cooked = compositionScoreTuple({ id: 'recipe', recipes: [soup], foods: [] }, ctx)
    const foodOnly = compositionScoreTuple({ id: 'food', recipes: [], foods: [bread] }, ctx)
    expect(compareScoreTuples(cooked, foodOnly)).toBeLessThan(0)
  })

  it('penalizes repeating a simple food when an alternative exists', () => {
    const banana: SimpleFood = {
      id: 'banana',
      ingredientId: 'ing-banana',
      name: 'Banana',
      defaultPortion: { value: 1, unit: 'piece' },
      roles: ['breakfast-component'],
      mealTypes: ['breakfast'],
      tagIds: [],
      enabledInSuggestions: true,
      createdAt: 0,
      updatedAt: 0,
    }
    const bread: SimpleFood = {
      id: 'bread',
      ingredientId: 'ing-bread',
      name: 'Bread',
      defaultPortion: { value: 2, unit: 'piece' },
      roles: ['breakfast-component'],
      mealTypes: ['breakfast'],
      tagIds: [],
      enabledInSuggestions: true,
      createdAt: 0,
      updatedAt: 0,
    }
    const ctx = context({ weekFoodIds: ['banana'] })
    const again = compositionScoreTuple({ id: 'banana', recipes: [], foods: [banana] }, ctx)
    const other = compositionScoreTuple({ id: 'bread', recipes: [], foods: [bread] }, ctx)
    expect(compareScoreTuples(other, again)).toBeLessThan(0)
  })

  it('counts two new cooks in one slot against the workload cap', () => {
    const first = recipe({ id: 'cutlets', effort: 'regular' })
    const second = recipe({ id: 'buckwheat', effort: 'regular' })
    const ctx = context({
      prefs: { ...DEFAULT_GENERATION_SOFT_PREFS, maxBatchPrepUnits: 1 },
    })
    const oneCook = compositionScoreTuple({ id: 'one', recipes: [first], foods: [] }, ctx)
    const twoCooks = compositionScoreTuple({ id: 'two', recipes: [first, second], foods: [] }, ctx)
    expect(oneCook[2]).toBe(0)
    expect(twoCooks[2]).toBe(1)
  })

  it('does not treat leftover cutlets with a new side as a repeated dish', () => {
    const cutlets = recipe({ id: 'cutlets', roles: ['main'] })
    const rice = recipe({ id: 'rice', roles: ['side'], effort: 'quick' })
    const buckwheat = recipe({ id: 'buckwheat', roles: ['side'], effort: 'quick' })
    const ctx = context({ weekRecipeIds: ['cutlets', 'rice'] })
    const leftoverPlate = compositionScoreTuple(
      { id: 'leftover-side', recipes: [buckwheat], foods: [], leftoverRecipes: [cutlets] },
      ctx,
    )
    const recook = compositionScoreTuple({ id: 'recook', recipes: [cutlets, rice], foods: [] }, ctx)
    expect(leftoverPlate[9]).toBe(0)
    expect(recook[9]).toBeGreaterThan(0)
    expect(compareScoreTuples(leftoverPlate, recook)).toBeLessThan(0)
  })

  it('does not treat leftover-only soup as a recook of soup', () => {
    const soup = recipe({ id: 'soup', name: 'Soup', roles: ['complete'] })
    const carbonara = recipe({
      id: 'carbonara',
      name: 'Carbonara',
      roles: ['complete'],
      effort: 'quick',
      reusePolicy: 'fresh-only',
    })
    const ctx = context({ weekRecipeIds: ['soup', 'carbonara'] })
    const leftover = compositionScoreTuple(
      { id: 'leftover-soup', recipes: [], foods: [], leftoverRecipes: [soup] },
      ctx,
    )
    const recook = compositionScoreTuple({ id: 'recook', recipes: [carbonara], foods: [] }, ctx)
    expect(leftover[9]).toBe(0)
    expect(recook[9]).toBeGreaterThan(0)
    expect(compareScoreTuples(leftover, recook)).toBeLessThan(0)
  })

  it('ranks a planned extra-use batch above a one-meal recook', () => {
    const soup = recipe({ id: 'soup', name: 'Soup', effort: 'regular' })
    const carbonara = recipe({
      id: 'carbonara',
      name: 'Carbonara',
      effort: 'quick',
      reusePolicy: 'fresh-only',
    })
    const ctx = context()
    const batched = compositionScoreTuple(
      { id: 'soup:extra:2', recipes: [soup], foods: [], extraUses: 2 },
      ctx,
    )
    const oneMeal = compositionScoreTuple({ id: 'carbonara', recipes: [carbonara], foods: [] }, ctx)
    expect(batched[8]).toBe(0)
    expect(oneMeal[8]).toBe(1)
    expect(compareScoreTuples(batched, oneMeal)).toBeLessThan(0)
  })

  it('prefers a recipe unused for this meal type after equal week uses', () => {
    const soup = recipe({ id: 'soup', name: 'Soup', effort: 'regular' })
    const carbonara = recipe({
      id: 'carbonara',
      name: 'Carbonara',
      effort: 'quick',
      reusePolicy: 'fresh-only',
    })
    const recency = emptyRecency()
    rememberUse(recency, 'recook', 'carbonara:lunch', '2026-01-06')
    rememberUse(recency, 'recook', 'soup:dinner', '2026-01-06')
    const ctx = context({
      date: '2026-01-07',
      mealType: 'lunch',
      weekRecipeIds: ['carbonara', 'soup'],
      recency,
    })
    expect(selectBestCandidate([carbonara, soup], ctx)?.recipe.id).toBe('soup')
  })
})

describe('compareWeekObjectives', () => {
  it('ranks coverage above preference penalties', () => {
    expect(
      compareWeekObjectives({ coverage: 2, penalties: [9, 9] }, { coverage: 1, penalties: [0, 0] }),
    ).toBeLessThan(0)
  })
})
