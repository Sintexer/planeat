import { describe, expect, it } from 'vitest'
import type { MealFavorite } from '../../favorites/MealFavorite'
import type { RecipePairing } from '../../pairings/RecipePairing'
import type { Recipe } from '../../recipes/Recipe'
import type { SimpleFood } from '../../simpleFoods/SimpleFood'
import { scaleQuantity } from '../../shared/scaleQuantity'
import { DEFAULT_GENERATION_HARD_POLICY } from './constraints'
import { assignmentFromCandidate, enumerateCompositionCandidates } from './compositions'
import { fingerprintFromInput, type GenerationInput } from './proposal'
import { DEFAULT_GENERATION_SOFT_PREFS } from './scoring'
import type { MealSlot } from '../MealSlot'

function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'cutlets',
    name: 'Cutlets',
    yield: { value: 4, unit: 'serving' },
    defaultPortionPerPerson: { value: 1, unit: 'serving' },
    ingredientLines: [],
    instructions: '',
    roles: ['main'],
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

function food(overrides: Partial<SimpleFood> = {}): SimpleFood {
  return {
    id: 'yogurt',
    ingredientId: 'ing-yogurt',
    name: 'Yogurt',
    defaultPortion: { value: 1, unit: 'cup' },
    roles: ['complete'],
    mealTypes: ['dinner'],
    tagIds: [],
    enabledInSuggestions: true,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

function favorite(overrides: Partial<MealFavorite> = {}): MealFavorite {
  return {
    id: 'fav-1',
    name: 'Cutlets and buckwheat',
    components: [
      {
        type: 'recipe',
        recipeId: 'cutlets',
        allocatedQuantity: { value: 2, unit: 'serving' },
      },
      {
        type: 'recipe',
        recipeId: 'buckwheat',
        allocatedQuantity: { value: 3, unit: 'serving' },
      },
    ],
    createdAt: 0,
    updatedAt: 1,
    ...overrides,
  }
}

function pairing(overrides: Partial<RecipePairing> = {}): RecipePairing {
  return {
    id: 'pair-1',
    recipeId: 'cutlets',
    target: { type: 'recipe', id: 'buckwheat' },
    relationship: 'pairs-with',
    ...overrides,
  }
}

function slot(overrides: Partial<MealSlot> = {}): MealSlot {
  return {
    id: 'slot-dinner',
    planId: 'plan-1',
    date: '2026-01-06',
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
    recipes: [],
    simpleFoods: [],
    favorites: [],
    pairings: [],
    requestedSlots: [{ slot: slot(), componentCount: 0 }],
    seed: 'seed-1',
    policy: DEFAULT_GENERATION_HARD_POLICY,
    fixedMeals: [],
    catalogs: { recipeIds: [], tagIds: [], ingredientIds: [] },
    softPrefs: DEFAULT_GENERATION_SOFT_PREFS,
    previousWeekRecipeIds: [],
    tagNamesById: {},
    ...overrides,
  }
}

describe('enumerateCompositionCandidates', () => {
  it('keeps a favorite with two non-complete recipes and stored quantities', () => {
    const cutlets = recipe()
    const buckwheat = recipe({ id: 'buckwheat', name: 'Buckwheat', roles: ['side'] })
    const snapshot = input({
      recipes: [cutlets, buckwheat],
      favorites: [favorite()],
    })
    const candidates = enumerateCompositionCandidates(snapshot, 'dinner')
    expect(candidates.map((row) => row.id)).toEqual(['favorite:fav-1'])
    const assignment = assignmentFromCandidate(
      candidates[0],
      'slot-dinner',
      'dinner',
      2,
      scaleQuantity,
    )
    expect(assignment?.components).toEqual([
      {
        type: 'recipe',
        recipeId: 'cutlets',
        recipeName: 'Cutlets',
        outputQuantity: { value: 2, unit: 'serving' },
        allocatedQuantity: { value: 2, unit: 'serving' },
        role: 'main',
      },
      {
        type: 'recipe',
        recipeId: 'buckwheat',
        recipeName: 'Buckwheat',
        outputQuantity: { value: 3, unit: 'serving' },
        allocatedQuantity: { value: 3, unit: 'serving' },
        role: 'side',
      },
    ])
  })

  it('never lists a suggestion-disabled simple food as standalone', () => {
    const yogurt = food({ enabledInSuggestions: false })
    const candidates = enumerateCompositionCandidates(input({ simpleFoods: [yogurt] }), 'dinner')
    expect(candidates).toEqual([])
  })

  it('may keep yogurt inside a favorite when suggestions are off', () => {
    const toast = recipe({ id: 'toast', name: 'Toast', roles: ['main'] })
    const yogurt = food({ enabledInSuggestions: false })
    const candidates = enumerateCompositionCandidates(
      input({
        recipes: [toast],
        simpleFoods: [yogurt],
        favorites: [
          favorite({
            id: 'fav-yogurt',
            name: 'Toast and yogurt',
            components: [
              {
                type: 'recipe',
                recipeId: 'toast',
                allocatedQuantity: { value: 1, unit: 'serving' },
              },
              {
                type: 'simple-food',
                simpleFoodId: 'yogurt',
                allocatedQuantity: { value: 1, unit: 'cup' },
              },
            ],
          }),
        ],
      }),
      'dinner',
    )
    expect(candidates.map((row) => row.id)).toEqual(['favorite:fav-yogurt'])
  })

  it('expands one stored pairing and does not invent a second combo', () => {
    const cutlets = recipe({ roles: ['complete'] })
    const buckwheat = recipe({ id: 'buckwheat', name: 'Buckwheat', roles: ['complete'] })
    const potatoes = recipe({ id: 'potatoes', name: 'Potatoes', roles: ['complete'] })
    const candidates = enumerateCompositionCandidates(
      input({
        recipes: [cutlets, buckwheat, potatoes],
        pairings: [pairing()],
      }),
      'dinner',
    )
    const pairingIds = candidates
      .filter((row) => row.source.type === 'pairing')
      .map((row) => row.id)
    expect(pairingIds).toEqual(['pairing:pair-1'])
    expect(
      candidates.some((row) => row.parts.length === 2 && row.source.type === 'standalone'),
    ).toBe(false)
    expect(
      candidates.some(
        (row) =>
          row.parts.length === 2 &&
          row.parts.some((part) => part.type === 'recipe' && part.recipe.id === 'potatoes'),
      ),
    ).toBe(false)
  })

  it('caps pairings per recipe', () => {
    const cutlets = recipe({ roles: ['complete'] })
    const sides = ['buckwheat', 'potatoes', 'salad'].map((id) =>
      recipe({ id, name: id, roles: ['side'] }),
    )
    const pairings = sides.map((side, index) =>
      pairing({
        id: `pair-${index}`,
        target: { type: 'recipe', id: side.id },
      }),
    )
    const candidates = enumerateCompositionCandidates(
      input({
        recipes: [cutlets, ...sides],
        pairings,
        compositionBounds: { maxPairingsPerRecipe: 2, maxComponentsPerCandidate: 4 },
      }),
      'dinner',
    )
    expect(candidates.filter((row) => row.source.type === 'pairing')).toHaveLength(2)
  })

  it('drops a favorite with a missing component and keeps other candidates', () => {
    const soup = recipe({ id: 'soup', name: 'Soup', roles: ['complete'] })
    const candidates = enumerateCompositionCandidates(
      input({
        recipes: [soup],
        favorites: [favorite()],
      }),
      'dinner',
    )
    expect(candidates.map((row) => row.id)).toEqual(['standalone:recipe:soup'])
  })

  it('drops a composition when any recipe is excluded', () => {
    const cutlets = recipe()
    const buckwheat = recipe({ id: 'buckwheat', name: 'Buckwheat', roles: ['side'] })
    const candidates = enumerateCompositionCandidates(
      input({
        recipes: [cutlets, buckwheat],
        favorites: [favorite()],
        policy: { ...DEFAULT_GENERATION_HARD_POLICY, excludedRecipeIds: ['buckwheat'] },
      }),
      'dinner',
    )
    expect(candidates).toEqual([])
  })

  it('treats includes as meal-level so one tagged component is enough', () => {
    const cutlets = recipe({ tagIds: ['comfort'] })
    const buckwheat = recipe({ id: 'buckwheat', name: 'Buckwheat', roles: ['side'] })
    const candidates = enumerateCompositionCandidates(
      input({
        recipes: [cutlets, buckwheat],
        favorites: [favorite()],
        policy: { ...DEFAULT_GENERATION_HARD_POLICY, requiredTagIds: ['comfort'] },
      }),
      'dinner',
    )
    expect(candidates.map((row) => row.id)).toEqual(['favorite:fav-1'])
  })

  it('drops a favorite when unknown time on one recipe is excluded', () => {
    const cutlets = recipe({ totalTimeMinutes: 20 })
    const buckwheat = recipe({
      id: 'buckwheat',
      name: 'Buckwheat',
      roles: ['side'],
      totalTimeMinutes: undefined,
    })
    const candidates = enumerateCompositionCandidates(
      input({
        recipes: [cutlets, buckwheat],
        favorites: [favorite()],
        policy: {
          ...DEFAULT_GENERATION_HARD_POLICY,
          maxTotalTimeMinutes: 45,
          unknownTimePolicy: 'exclude',
        },
      }),
      'dinner',
    )
    expect(candidates).toEqual([])
  })

  it('treats empty simple-food mealTypes as no occasion match', () => {
    const candidates = enumerateCompositionCandidates(
      input({ simpleFoods: [food({ mealTypes: [] })] }),
      'dinner',
    )
    expect(candidates).toEqual([])
  })

  it('changes the fingerprint when a favorite, pairing, or composition bound changes', () => {
    const cutlets = recipe({ roles: ['complete'] })
    const base = input({ recipes: [cutlets], favorites: [favorite()], pairings: [pairing()] })
    const afterFavorite = input({
      recipes: [cutlets],
      favorites: [favorite({ updatedAt: 99 })],
      pairings: [pairing()],
    })
    const afterPairing = input({
      recipes: [cutlets],
      favorites: [favorite()],
      pairings: [pairing({ id: 'pair-2' })],
    })
    const afterBounds = input({
      recipes: [cutlets],
      favorites: [favorite()],
      pairings: [pairing()],
      compositionBounds: { maxPairingsPerRecipe: 1, maxComponentsPerCandidate: 4 },
    })
    expect(fingerprintFromInput(base)).not.toBe(fingerprintFromInput(afterFavorite))
    expect(fingerprintFromInput(base)).not.toBe(fingerprintFromInput(afterPairing))
    expect(fingerprintFromInput(base)).not.toBe(fingerprintFromInput(afterBounds))
  })
})
