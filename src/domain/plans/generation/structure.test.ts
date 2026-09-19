import { describe, expect, it } from 'vitest'
import { DEFAULT_GENERATION_HARD_POLICY } from './constraints'
import type { GenerationInput } from './proposal'
import { DEFAULT_GENERATION_SOFT_PREFS } from './scoring'
import { analyzeCatalog } from './capabilities'
import { buildWeekStructure, resolveDayLoad } from './structure'
import type { MealSlot } from '../MealSlot'
import type { Recipe } from '../../recipes/Recipe'

function recipe(): Recipe {
  return {
    id: 'soup',
    name: 'Soup',
    yield: { value: 4, unit: 'serving' },
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
    updatedAt: 0,
  }
}

function slot(overrides: Partial<MealSlot> = {}): MealSlot {
  return {
    id: 'slot-mon',
    planId: 'plan-1',
    date: '2026-01-05',
    mealType: 'dinner',
    excluded: false,
    ...overrides,
  }
}

function input(overrides: Partial<GenerationInput> = {}): GenerationInput {
  return {
    planId: 'plan-1',
    planRevision: 1,
    peopleCount: 2,
    recipes: [recipe()],
    requestedSlots: [{ slot: slot(), componentCount: 0 }],
    seed: 's',
    policy: DEFAULT_GENERATION_HARD_POLICY,
    fixedMeals: [],
    catalogs: { recipeIds: ['soup'], tagIds: [], ingredientIds: [] },
    softPrefs: DEFAULT_GENERATION_SOFT_PREFS,
    previousWeekRecipeIds: [],
    tagNamesById: {},
    ...overrides,
  }
}

describe('buildWeekStructure', () => {
  it('marks a free dinner as a potential anchor and a later busy meal as reuse', () => {
    const snapshot = input({
      dayLoad: { '2026-01-05': 'free', '2026-01-06': 'busy' },
      requestedSlots: [
        { slot: slot(), componentCount: 0 },
        { slot: slot({ id: 'slot-tue', date: '2026-01-06' }), componentCount: 0 },
      ],
    })
    const structure = buildWeekStructure(snapshot, analyzeCatalog(snapshot))
    expect(structure.slots[0]?.potentialAnchor).toBe(true)
    expect(structure.slots[1]?.potentialReuseFrom).toEqual(['slot-mon'])
    expect(resolveDayLoad('2026-01-06', snapshot)).toBe('busy')
  })

  it('prefers household quick-meal weekdays as busy when the request has no overlay', () => {
    const snapshot = input({
      requestedSlots: [{ slot: slot({ date: '2026-01-07' }), componentCount: 0 }],
      softPrefs: { ...DEFAULT_GENERATION_SOFT_PREFS, quickMealsOnlyDays: [3] },
    })
    expect(resolveDayLoad('2026-01-07', snapshot)).toBe('busy')
  })
})
