import { describe, expect, it } from 'vitest'
import type { Recipe } from '../../recipes/Recipe'
import { scaleQuantity } from '../../shared/scaleQuantity'
import type { MealSlot } from '../MealSlot'
import { DEFAULT_GENERATION_HARD_POLICY } from './constraints'
import {
  fingerprintFromInput,
  type GenerationInput,
  type GenerationLeftoverEvent,
} from './proposal'
import { compositionScoreTuple, DEFAULT_GENERATION_SOFT_PREFS } from './scoring'
import { runGenerationSearch } from './search'

function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'chili',
    name: 'Chili',
    yield: { value: 6, unit: 'serving' },
    defaultPortionPerPerson: { value: 1, unit: 'serving' },
    ingredientLines: [],
    instructions: '',
    roles: ['complete'],
    mealTypes: ['dinner'],
    effort: 'regular',
    reusePolicy: 'batch-friendly',
    freezerFriendly: false,
    tagIds: [],
    createdAt: 0,
    updatedAt: 10,
    ...overrides,
  }
}

function leftover(overrides: Partial<GenerationLeftoverEvent> = {}): GenerationLeftoverEvent {
  const chili = recipe()
  return {
    id: 'event-chili',
    recipeId: chili.id,
    recipeName: chili.name,
    scheduledDate: '2026-01-05',
    outputQuantity: { value: 6, unit: 'serving' },
    remaining: { value: 3, unit: 'serving' },
    desiredQuantity: { value: 2, unit: 'serving' },
    reusePolicy: 'batch-friendly',
    mealTypes: ['dinner'],
    recipe: chili,
    ...overrides,
  }
}

function slot(overrides: Partial<MealSlot> = {}): MealSlot {
  return {
    id: 'slot-tue',
    planId: 'plan-1',
    date: '2026-01-06',
    mealType: 'dinner',
    excluded: false,
    ...overrides,
  }
}

function input(overrides: Partial<GenerationInput> = {}): GenerationInput {
  const chili = recipe()
  return {
    planId: 'plan-1',
    planRevision: 1,
    peopleCount: 2,
    recipes: [chili],
    cookingEvents: [leftover({ recipe: chili })],
    requestedSlots: [{ slot: slot(), componentCount: 0 }],
    seed: 'seed-1',
    policy: DEFAULT_GENERATION_HARD_POLICY,
    fixedMeals: [],
    catalogs: { recipeIds: ['chili'], tagIds: [], ingredientIds: [] },
    softPrefs: DEFAULT_GENERATION_SOFT_PREFS,
    previousWeekRecipeIds: [],
    tagNamesById: {},
    ...overrides,
  }
}

describe('leftover generation search', () => {
  it('allocates Monday leftover to Tuesday dinner', () => {
    const proposal = runGenerationSearch(input(), 'req-1', scaleQuantity)
    expect(proposal.assignments[0]?.source).toEqual({
      type: 'leftover',
      cookingEventId: 'event-chili',
    })
    expect(proposal.assignments[0]?.components[0]).toMatchObject({
      type: 'leftover',
      cookingEventId: 'event-chili',
      allocatedQuantity: { value: 2, unit: 'serving' },
    })
  })

  it('does not propose leftover before the cooking date', () => {
    const proposal = runGenerationSearch(
      input({
        recipes: [],
        requestedSlots: [{ slot: slot({ id: 'slot-sun', date: '2026-01-04' }), componentCount: 0 }],
      }),
      'req-1',
      scaleQuantity,
    )
    expect(proposal.assignments).toEqual([])
    expect(proposal.unfilled[0]?.reason).toBe('no-eligible-candidates')
  })

  it('does not take leftover when remaining is already zero', () => {
    const stew = recipe({ id: 'stew', name: 'Stew' })
    const proposal = runGenerationSearch(
      input({
        recipes: [stew],
        cookingEvents: [leftover({ remaining: { value: 0, unit: 'serving' } })],
        catalogs: { recipeIds: ['stew'], tagIds: [], ingredientIds: [] },
      }),
      'req-1',
      scaleQuantity,
    )
    expect(proposal.assignments[0]?.source).toEqual({ type: 'standalone' })
    expect(proposal.assignments[0]?.components[0]).toMatchObject({
      type: 'recipe',
      recipeId: 'stew',
    })
  })

  it('does not over-allocate one remaining pool across two later slots', () => {
    const tue = slot()
    const wed = slot({ id: 'slot-wed', date: '2026-01-07' })
    const proposal = runGenerationSearch(
      input({
        recipes: [],
        cookingEvents: [
          leftover({
            remaining: { value: 2, unit: 'serving' },
            desiredQuantity: { value: 2, unit: 'serving' },
          }),
        ],
        requestedSlots: [
          { slot: tue, componentCount: 0 },
          { slot: wed, componentCount: 0 },
        ],
      }),
      'req-1',
      scaleQuantity,
    )
    expect(proposal.assignments).toHaveLength(1)
    expect(proposal.assignments[0]?.components[0]).toMatchObject({
      type: 'leftover',
      allocatedQuantity: { value: 2, unit: 'serving' },
    })
    expect(proposal.unfilled).toHaveLength(1)
  })

  it('blocks later-day leftover for fresh-only and same-day', () => {
    for (const reusePolicy of ['fresh-only', 'same-day'] as const) {
      const proposal = runGenerationSearch(
        input({
          recipes: [],
          cookingEvents: [leftover({ reusePolicy })],
        }),
        'req-1',
        scaleQuantity,
      )
      expect(proposal.assignments).toEqual([])
    }
  })

  it('drops leftover of an excluded recipe', () => {
    const stew = recipe({ id: 'stew', name: 'Stew' })
    const proposal = runGenerationSearch(
      input({
        recipes: [stew],
        cookingEvents: [leftover({ recipe: recipe({ id: 'chili' }) })],
        policy: { ...DEFAULT_GENERATION_HARD_POLICY, excludedRecipeIds: ['chili'] },
        catalogs: { recipeIds: ['chili', 'stew'], tagIds: [], ingredientIds: [] },
      }),
      'req-1',
      scaleQuantity,
    )
    expect(proposal.assignments[0]?.components[0]).toMatchObject({
      type: 'recipe',
      recipeId: 'stew',
    })
  })

  it('does not increment cooking-event count for leftover-only', () => {
    const leftoverScore = compositionScoreTuple(
      { id: 'leftover', recipes: [], foods: [], leftoverRecipes: [recipe()] },
      {
        date: '2026-01-06',
        mealType: 'dinner',
        prefs: { ...DEFAULT_GENERATION_SOFT_PREFS, maxBatchPrepUnits: 1 },
        weekRecipeIds: [],
        previousWeekRecipeIds: [],
        demandingCooksOnDate: 0,
        cookingEventCountOnDate: 1,
        tagNamesById: {},
      },
    )
    const cookScore = compositionScoreTuple(
      { id: 'cook', recipes: [recipe()], foods: [] },
      {
        date: '2026-01-06',
        mealType: 'dinner',
        prefs: { ...DEFAULT_GENERATION_SOFT_PREFS, maxBatchPrepUnits: 1 },
        weekRecipeIds: [],
        previousWeekRecipeIds: [],
        demandingCooksOnDate: 0,
        cookingEventCountOnDate: 1,
        tagNamesById: {},
      },
    )
    expect(leftoverScore[2]).toBe(0)
    expect(cookScore[2]).toBe(1)
    expect(leftoverScore[5]).toBe(0)
  })

  it('changes fingerprint when leftover remaining changes', () => {
    const base = input()
    const less = input({
      cookingEvents: [leftover({ remaining: { value: 1, unit: 'serving' } })],
    })
    expect(fingerprintFromInput(base)).not.toBe(fingerprintFromInput(less))
  })
})
