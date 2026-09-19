import { describe, expect, it } from 'vitest'
import type { Recipe } from '../../recipes/Recipe'
import { scaleQuantity } from '../../shared/scaleQuantity'
import type { MealSlot } from '../MealSlot'
import { DEFAULT_GENERATION_HARD_POLICY } from './constraints'
import {
  fingerprintFromInput,
  mergeGenerationSearchBudget,
  DEFAULT_GENERATION_SEARCH_BUDGET,
  type GenerationInput,
  type SlotAssignment,
} from './proposal'
import { compareWeekObjectives, DEFAULT_GENERATION_SOFT_PREFS } from './scoring'
import {
  runGenerationSearch,
  runIndependentGreedySearch,
  weekObjectiveForAssignments,
} from './search'

function recipe(overrides: Partial<Recipe> = {}): Recipe {
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
    updatedAt: 10,
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

function firstRecipeId(assignment: SlotAssignment): string | undefined {
  const component = assignment.components.find((row) => row.type === 'recipe')
  return component?.type === 'recipe' ? component.recipeId : undefined
}

function firstRecipeQuantity(assignment: SlotAssignment) {
  const component = assignment.components.find((row) => row.type === 'recipe')
  return component?.type === 'recipe' ? component.outputQuantity : undefined
}

function input(overrides: Partial<GenerationInput> = {}): GenerationInput {
  const dinner = slot()
  return {
    planId: 'plan-1',
    planRevision: 1,
    peopleCount: 2,
    recipes: [recipe()],
    requestedSlots: [{ slot: dinner, componentCount: 0 }],
    seed: 'seed-1',
    policy: DEFAULT_GENERATION_HARD_POLICY,
    fixedMeals: [],
    catalogs: { recipeIds: ['soup'], tagIds: [], ingredientIds: [] },
    softPrefs: DEFAULT_GENERATION_SOFT_PREFS,
    previousWeekRecipeIds: [],
    tagNamesById: {},
    ...overrides,
  }
}

describe('runGenerationSearch', () => {
  it('fills requested empty slots independently', () => {
    const lunch = slot({ id: 'slot-lunch', mealType: 'lunch', date: '2026-01-05' })
    const dinner = slot()
    const lunchOnly = recipe({ id: 'oats', name: 'Oats', mealTypes: ['lunch'] })
    const dinnerOnly = recipe({ id: 'soup', mealTypes: ['dinner'] })
    const proposal = runGenerationSearch(
      input({
        recipes: [lunchOnly, dinnerOnly],
        requestedSlots: [
          { slot: lunch, componentCount: 0 },
          { slot: dinner, componentCount: 0 },
        ],
      }),
      'req-1',
      scaleQuantity,
    )
    expect(proposal.assignments.map((row) => row.slotId)).toEqual(['slot-lunch', 'slot-dinner'])
    expect(firstRecipeId(proposal.assignments[0])).toBe('oats')
    expect(firstRecipeId(proposal.assignments[1])).toBe('soup')
    expect(proposal.unfilled).toEqual([])
    expect(proposal.seed).toBe('seed-1')
  })

  it('leaves a requested slot unfilled when nothing is eligible', () => {
    const lunch = slot({ id: 'slot-lunch', mealType: 'lunch' })
    const proposal = runGenerationSearch(
      input({
        requestedSlots: [
          { slot: lunch, componentCount: 0 },
          { slot: slot(), componentCount: 0 },
        ],
      }),
      'req-1',
      scaleQuantity,
    )
    expect(proposal.assignments).toHaveLength(1)
    expect(proposal.unfilled).toEqual([
      { slotId: 'slot-lunch', reason: 'no-eligible-candidates', mealType: 'lunch' },
    ])
  })

  it('does not assign filled or excluded slots', () => {
    const filled = slot({ id: 'slot-filled' })
    const excluded = slot({ id: 'slot-out', excluded: true })
    const proposal = runGenerationSearch(
      input({
        requestedSlots: [
          { slot: filled, componentCount: 1 },
          { slot: excluded, componentCount: 0 },
        ],
      }),
      'req-1',
      scaleQuantity,
    )
    expect(proposal.unfilled.map((row) => row.slotId)).toEqual(['slot-filled', 'slot-out'])
    expect(proposal.assignments).toEqual([])
  })

  it('is deterministic for the same snapshot, seed, and version', () => {
    const snapshot = input()
    const a = runGenerationSearch(snapshot, 'req-a', scaleQuantity)
    const b = runGenerationSearch(snapshot, 'req-b', scaleQuantity)
    expect(a.fingerprint).toBe(b.fingerprint)
    expect(a.assignments).toEqual(b.assignments)
    expect(a.algorithmVersion).toBe('35')
  })

  it('uses a per-slot quantity override', () => {
    const proposal = runGenerationSearch(
      input({
        quantityOverrides: { 'slot-dinner': { value: 9, unit: 'serving' } },
      }),
      'req-1',
      scaleQuantity,
    )
    expect(firstRecipeQuantity(proposal.assignments[0])).toEqual({ value: 9, unit: 'serving' })
  })

  it('does not pick an excluded ingredient and reports a fixed conflict', () => {
    const peanut = recipe({
      id: 'peanut-stew',
      ingredientLines: [{ displayText: 'peanut', ingredientId: 'peanut', quantity: null }],
    })
    const rice = recipe({
      id: 'rice',
      name: 'Rice',
      ingredientLines: [{ displayText: 'rice', ingredientId: 'rice', quantity: null }],
    })
    const proposal = runGenerationSearch(
      input({
        recipes: [peanut, rice],
        policy: {
          ...DEFAULT_GENERATION_HARD_POLICY,
          excludeIngredientIds: ['peanut'],
        },
        catalogs: {
          recipeIds: ['peanut-stew', 'rice'],
          tagIds: [],
          ingredientIds: ['peanut', 'rice'],
        },
        fixedMeals: [
          {
            slotId: 'slot-mon',
            date: '2026-01-05',
            mealType: 'dinner',
            recipeId: 'peanut-stew',
            recipe: peanut,
          },
        ],
      }),
      'req-1',
      scaleQuantity,
    )
    expect(proposal.assignments).toHaveLength(1)
    expect(firstRecipeId(proposal.assignments[0])).toBe('rice')
    expect(proposal.diagnostics.fixedConflicts[0]).toMatchObject({
      slotId: 'slot-mon',
      reasons: ['exclude-ingredients'],
    })
  })

  it('prefers a quick recipe on a configured quick-meal day', () => {
    const demanding = recipe({ id: 'aaa', effort: 'demanding', totalTimeMinutes: 25 })
    const quick = recipe({ id: 'zzz', name: 'Eggs', effort: 'quick', totalTimeMinutes: 15 })
    const wednesday = slot({ date: '2026-01-07' })
    const proposal = runGenerationSearch(
      input({
        recipes: [demanding, quick],
        requestedSlots: [{ slot: wednesday, componentCount: 0 }],
        softPrefs: { ...DEFAULT_GENERATION_SOFT_PREFS, quickMealsOnlyDays: [3] },
      }),
      'req-1',
      scaleQuantity,
    )
    expect(firstRecipeId(proposal.assignments[0])).toBe('zzz')
    expect(proposal.assignments[0].scoreReasons.some((row) => row.code === 'quick-day')).toBe(true)
  })
})

describe('fingerprintFromInput', () => {
  it('changes when seed, requested set, revision, peopleCount, or recipe updatedAt change', () => {
    const base = fingerprintFromInput(input())
    expect(fingerprintFromInput(input({ seed: 'other' }))).not.toBe(base)
    expect(fingerprintFromInput(input({ planRevision: 2 }))).not.toBe(base)
    expect(fingerprintFromInput(input({ peopleCount: 4 }))).not.toBe(base)
    expect(fingerprintFromInput(input({ recipes: [recipe({ updatedAt: 99 })] }))).not.toBe(base)
    const extra = slot({ id: 'slot-lunch', mealType: 'lunch' })
    expect(
      fingerprintFromInput(
        input({
          requestedSlots: [
            { slot: slot(), componentCount: 0 },
            { slot: extra, componentCount: 0 },
          ],
        }),
      ),
    ).not.toBe(base)
  })

  it('changes when soft prefs or previous-week history change', () => {
    const base = fingerprintFromInput(input())
    expect(
      fingerprintFromInput(
        input({
          softPrefs: { ...DEFAULT_GENERATION_SOFT_PREFS, quickMealsOnlyDays: [3] },
        }),
      ),
    ).not.toBe(base)
    expect(fingerprintFromInput(input({ previousWeekRecipeIds: ['soup'] }))).not.toBe(base)
  })

  it('changes when the search budget changes', () => {
    const base = fingerprintFromInput(input())
    expect(
      fingerprintFromInput(
        input({
          searchBudget: { beamWidth: 2, expansionBudget: 10, perSlotCandidateLimit: 2 },
        }),
      ),
    ).not.toBe(base)
  })
})

describe('mergeGenerationSearchBudget', () => {
  it('clamps invalid values onto defaults and bounds', () => {
    expect(mergeGenerationSearchBudget(undefined)).toEqual(DEFAULT_GENERATION_SEARCH_BUDGET)
    expect(
      mergeGenerationSearchBudget({ beamWidth: 0, expansionBudget: -3, perSlotCandidateLimit: 99 }),
    ).toEqual({
      beamWidth: 1,
      expansionBudget: 1,
      perSlotCandidateLimit: 32,
    })
  })
})

describe('bounded weekly search', () => {
  const lunch = slot({ id: 'slot-lunch', mealType: 'lunch', date: '2026-01-05' })
  const dinner = slot({ id: 'slot-dinner', mealType: 'dinner', date: '2026-01-05' })
  const oats = recipe({
    id: 'oats',
    name: 'Oats',
    mealTypes: ['lunch', 'dinner'],
    effort: 'quick',
  })
  const pasta = recipe({
    id: 'pasta',
    name: 'Pasta',
    mealTypes: ['lunch'],
    effort: 'regular',
  })
  const lookaheadInput = (): GenerationInput =>
    input({
      recipes: [oats, pasta],
      requestedSlots: [
        { slot: lunch, componentCount: 0 },
        { slot: dinner, componentCount: 0 },
      ],
      catalogs: { recipeIds: ['oats', 'pasta'], tagIds: [], ingredientIds: [] },
    })

  it('beats sequential greedy on a lookahead repetition fixture', () => {
    const snapshot = lookaheadInput()
    const greedy = runIndependentGreedySearch(snapshot, 'req-g', scaleQuantity)
    const beam = runGenerationSearch(snapshot, 'req-b', scaleQuantity)
    expect(greedy.assignments.map((row) => firstRecipeId(row))).toEqual(['oats', 'oats'])
    expect(beam.assignments.map((row) => `${row.slotId}:${firstRecipeId(row)}`)).toEqual([
      'slot-lunch:pasta',
      'slot-dinner:oats',
    ])
    expect(beam.unfilled).toEqual([])
    const greedyScore = weekObjectiveForAssignments(snapshot, greedy.assignments)
    const beamScore = weekObjectiveForAssignments(snapshot, beam.assignments)
    expect(greedyScore.coverage).toBe(beamScore.coverage)
    expect(compareWeekObjectives(beamScore, greedyScore)).toBeLessThan(0)
  })

  it('returns search-incomplete when the expansion budget runs out', () => {
    const snapshot = lookaheadInput()
    const proposal = runGenerationSearch(
      {
        ...snapshot,
        searchBudget: { beamWidth: 8, perSlotCandidateLimit: 8, expansionBudget: 1 },
      },
      'req-1',
      scaleQuantity,
    )
    expect(proposal.assignments.length).toBeGreaterThanOrEqual(1)
    expect(proposal.unfilled.some((row) => row.reason === 'search-incomplete')).toBe(true)
    expect(proposal.unfilled.some((row) => row.reason === 'no-eligible-candidates')).toBe(false)
    expect(proposal.expansionsUsed).toBe(1)
    expect(proposal.budgetUsed.expansionBudget).toBe(1)
  })

  it('does not claim no-eligible-candidates when candidates exist but the budget ends', () => {
    const extraDinner = slot({ id: 'slot-tue', mealType: 'dinner', date: '2026-01-06' })
    const proposal = runGenerationSearch(
      input({
        recipes: [recipe({ id: 'soup', mealTypes: ['dinner'] })],
        requestedSlots: [
          { slot: slot(), componentCount: 0 },
          { slot: extraDinner, componentCount: 0 },
        ],
        searchBudget: { beamWidth: 1, perSlotCandidateLimit: 1, expansionBudget: 1 },
      }),
      'req-1',
      scaleQuantity,
    )
    expect(proposal.assignments).toHaveLength(1)
    expect(proposal.unfilled).toEqual([
      { slotId: 'slot-tue', mealType: 'dinner', reason: 'search-incomplete' },
    ])
  })

  it('can change equal-score truncation when the seed changes and the candidate limit is tight', () => {
    const twins = ['aa', 'bb', 'cc', 'dd', 'ee'].map((id) =>
      recipe({ id, name: id, effort: 'regular', mealTypes: ['dinner'] }),
    )
    const tight = {
      beamWidth: 1,
      perSlotCandidateLimit: 1,
      expansionBudget: 20,
    }
    const picked = ['seed-a', 'seed-b', 'seed-c', 'seed-d', 'seed-e', 'seed-f'].map((seed) => {
      const proposal = runGenerationSearch(
        input({ recipes: twins, seed, searchBudget: tight }),
        'req-1',
        scaleQuantity,
      )
      return firstRecipeId(proposal.assignments[0])
    })
    expect(new Set(picked).size).toBeGreaterThan(1)
  })

  it('never replaces the incumbent with a lexicographically worse week when extra recipes exist', () => {
    const snapshot = lookaheadInput()
    const withoutExtra = runGenerationSearch(snapshot, 'req-1', scaleQuantity)
    const extra = recipe({
      id: 'zzz-extra',
      name: 'Extra stew',
      mealTypes: ['lunch', 'dinner'],
      effort: 'demanding',
    })
    const withExtra = runGenerationSearch(
      {
        ...snapshot,
        recipes: [...snapshot.recipes, extra],
        catalogs: { recipeIds: ['oats', 'pasta', extra.id], tagIds: [], ingredientIds: [] },
      },
      'req-1',
      scaleQuantity,
    )
    expect(
      compareWeekObjectives(
        weekObjectiveForAssignments(
          { ...snapshot, recipes: [...snapshot.recipes, extra] },
          withExtra.assignments,
        ),
        weekObjectiveForAssignments(snapshot, withoutExtra.assignments),
      ),
    ).toBeLessThanOrEqual(0)
  })

  it('still respects hard ingredient exclusions', () => {
    const peanut = recipe({
      id: 'peanut-stew',
      mealTypes: ['dinner'],
      ingredientLines: [{ displayText: 'peanut', ingredientId: 'peanut', quantity: null }],
    })
    const rice = recipe({
      id: 'rice',
      name: 'Rice',
      mealTypes: ['dinner'],
      ingredientLines: [{ displayText: 'rice', ingredientId: 'rice', quantity: null }],
    })
    const proposal = runGenerationSearch(
      input({
        recipes: [peanut, rice],
        policy: { ...DEFAULT_GENERATION_HARD_POLICY, excludeIngredientIds: ['peanut'] },
        catalogs: {
          recipeIds: ['peanut-stew', 'rice'],
          tagIds: [],
          ingredientIds: ['peanut', 'rice'],
        },
      }),
      'req-1',
      scaleQuantity,
    )
    expect(firstRecipeId(proposal.assignments[0])).toBe('rice')
  })

  it('fills a dinner from a two-recipe favorite', () => {
    const cutlets = recipe({
      id: 'cutlets',
      name: 'Cutlets',
      roles: ['main'],
      mealTypes: ['dinner'],
    })
    const buckwheat = recipe({
      id: 'buckwheat',
      name: 'Buckwheat',
      roles: ['side'],
      mealTypes: ['dinner'],
    })
    const proposal = runGenerationSearch(
      input({
        recipes: [cutlets, buckwheat],
        favorites: [
          {
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
                allocatedQuantity: { value: 2, unit: 'serving' },
              },
            ],
            createdAt: 0,
            updatedAt: 1,
          },
        ],
      }),
      'req-1',
      scaleQuantity,
    )
    expect(proposal.assignments[0]?.source).toEqual({
      type: 'favorite',
      favoriteId: 'fav-1',
      favoriteName: 'Cutlets and buckwheat',
    })
    expect(
      proposal.assignments[0]?.components.map((row) => row.type === 'recipe' && row.recipeId),
    ).toEqual(['cutlets', 'buckwheat'])
  })

  it('does not invent a main and side that were never paired', () => {
    const main = recipe({ id: 'cutlets', name: 'Cutlets', roles: ['complete'] })
    const side = recipe({ id: 'buckwheat', name: 'Buckwheat', roles: ['complete'] })
    const proposal = runGenerationSearch(input({ recipes: [main, side] }), 'req-1', scaleQuantity)
    expect(proposal.assignments[0]?.components).toHaveLength(1)
    expect(proposal.assignments[0]?.source).toEqual({ type: 'standalone' })
  })

  it('can pick an explicit pairing of two non-complete recipes', () => {
    const cutlets = recipe({ id: 'cutlets', name: 'Cutlets', roles: ['main'] })
    const buckwheat = recipe({ id: 'buckwheat', name: 'Buckwheat', roles: ['side'] })
    const proposal = runGenerationSearch(
      input({
        recipes: [cutlets, buckwheat],
        pairings: [
          {
            id: 'pair-1',
            recipeId: 'cutlets',
            target: { type: 'recipe', id: 'buckwheat' },
            relationship: 'pairs-with',
          },
        ],
      }),
      'req-1',
      scaleQuantity,
    )
    expect(proposal.assignments[0]?.source).toEqual({ type: 'pairing', pairingId: 'pair-1' })
    expect(proposal.assignments[0]?.components).toHaveLength(2)
  })

  it('never picks suggestion-disabled yogurt on its own', () => {
    const proposal = runGenerationSearch(
      input({
        recipes: [],
        simpleFoods: [
          {
            id: 'yogurt',
            ingredientId: 'ing-yogurt',
            name: 'Yogurt',
            defaultPortion: { value: 1, unit: 'cup' },
            roles: ['complete'],
            mealTypes: ['dinner'],
            tagIds: [],
            enabledInSuggestions: false,
            createdAt: 0,
            updatedAt: 0,
          },
        ],
      }),
      'req-1',
      scaleQuantity,
    )
    expect(proposal.assignments).toEqual([])
    expect(proposal.unfilled[0]?.reason).toBe('no-eligible-candidates')
  })
})
