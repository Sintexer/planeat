import { describe, expect, it } from 'vitest'
import type { Recipe } from '../../recipes/Recipe'
import { DEFAULT_GENERATION_HARD_POLICY } from './constraints'
import { analyzeCatalog } from './capabilities'
import type { GenerationInput } from './proposal'
import { DEFAULT_GENERATION_SOFT_PREFS } from './scoring'
import type { MealSlot } from '../MealSlot'

function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'chili',
    name: 'Chili',
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
    ...overrides,
  }
}

function slot(overrides: Partial<MealSlot> = {}): MealSlot {
  return {
    id: 'slot-dinner',
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
    catalogs: { recipeIds: ['chili'], tagIds: [], ingredientIds: [] },
    softPrefs: DEFAULT_GENERATION_SOFT_PREFS,
    previousWeekRecipeIds: [],
    tagNamesById: {},
    ...overrides,
  }
}

describe('analyzeCatalog', () => {
  it('counts reusable complete mains separately from mains that need a stored partner', () => {
    const main = recipe({
      id: 'cutlets',
      name: 'Cutlets',
      roles: ['main'],
      reusePolicy: 'fresh-only',
    })
    const rice = recipe({ id: 'rice', name: 'Rice', roles: ['side'] })
    const inventory = analyzeCatalog(
      input({
        recipes: [recipe(), main, rice],
        pairings: [
          {
            id: 'p1',
            recipeId: 'cutlets',
            target: { type: 'recipe', id: 'rice' },
            relationship: 'pairs-with',
          },
        ],
      }),
    )
    expect(inventory.summary.reusableMains).toBe(1)
    expect(inventory.mainsNeedingAccompaniment.map((row) => row.id)).toEqual(['cutlets'])
    expect(inventory.missingMetadata).not.toContain('no-reusable-mains')
  })

  it('does not treat an unpaired main as a reusable strategy', () => {
    const inventory = analyzeCatalog(
      input({
        recipes: [recipe({ reusePolicy: 'fresh-only', roles: ['main'] })],
      }),
    )
    expect(inventory.summary.reusableMains).toBe(0)
    expect(inventory.mainsNeedingAccompaniment).toEqual([])
    expect(inventory.missingMetadata).toContain('no-reusable-mains')
  })
})
