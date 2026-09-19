import { describe, expect, it } from 'vitest'
import type { Recipe } from '../../recipes/Recipe'
import type { SimpleFood } from '../../simpleFoods/SimpleFood'
import { DEFAULT_GENERATION_HARD_POLICY } from './constraints'
import { analyzeCatalog } from './capabilities'
import { breakfastPatterns, rotateBreakfastPattern } from './breakfast'
import { emptyRecency, rememberUse } from './recency'
import type { GenerationInput } from './proposal'
import { DEFAULT_GENERATION_SOFT_PREFS } from './scoring'
import type { MealSlot } from '../MealSlot'

function oats(): Recipe {
  return {
    id: 'oats',
    name: 'Oats',
    yield: { value: 1, unit: 'serving' },
    defaultPortionPerPerson: { value: 1, unit: 'serving' },
    ingredientLines: [],
    instructions: '',
    roles: ['complete'],
    mealTypes: ['breakfast'],
    effort: 'quick',
    reusePolicy: 'fresh-only',
    freezerFriendly: false,
    tagIds: [],
    createdAt: 0,
    updatedAt: 0,
  }
}

function food(id: string, name: string): SimpleFood {
  return {
    id,
    ingredientId: `ing-${id}`,
    name,
    defaultPortion: { value: 1, unit: 'piece' },
    roles: ['breakfast-component'],
    mealTypes: ['breakfast'],
    tagIds: [],
    enabledInSuggestions: true,
    createdAt: 0,
    updatedAt: 0,
  }
}

function input(): GenerationInput {
  const slot: MealSlot = {
    id: 'b1',
    planId: 'plan-1',
    date: '2026-01-05',
    mealType: 'breakfast',
    excluded: false,
  }
  return {
    planId: 'plan-1',
    planRevision: 1,
    peopleCount: 2,
    recipes: [oats()],
    simpleFoods: [food('banana', 'Banana'), food('bread', 'Bread')],
    requestedSlots: [{ slot, componentCount: 0 }],
    seed: 's',
    policy: DEFAULT_GENERATION_HARD_POLICY,
    fixedMeals: [],
    catalogs: { recipeIds: ['oats'], tagIds: [], ingredientIds: [] },
    softPrefs: DEFAULT_GENERATION_SOFT_PREFS,
    previousWeekRecipeIds: [],
    tagNamesById: {},
  }
}

describe('breakfastPatterns', () => {
  it('rotates least-recent patterns first', () => {
    const snapshot = input()
    const patterns = breakfastPatterns(snapshot, analyzeCatalog(snapshot))
    const recency = emptyRecency()
    rememberUse(recency, 'composition', 'standalone:food:banana', '2026-01-05')
    const rotated = rotateBreakfastPattern(patterns, recency, '2026-01-06', 'breakfast')
    expect(rotated[0]?.id).not.toBe('standalone:food:banana')
  })
})
