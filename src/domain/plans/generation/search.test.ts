import { describe, expect, it } from 'vitest'
import type { Recipe } from '../../recipes/Recipe'
import { scaleQuantity } from '../../shared/scaleQuantity'
import type { MealSlot } from '../MealSlot'
import { DEFAULT_GENERATION_HARD_POLICY } from './constraints'
import { fingerprintFromInput, type GenerationInput } from './proposal'
import { runGenerationSearch } from './search'

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
    expect(proposal.assignments[0].recipeId).toBe('oats')
    expect(proposal.assignments[1].recipeId).toBe('soup')
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
    expect(proposal.assignments).toEqual([])
    expect(proposal.unfilled.map((row) => row.slotId)).toEqual(['slot-filled', 'slot-out'])
  })

  it('is deterministic for the same snapshot, seed, and version', () => {
    const snapshot = input()
    const a = runGenerationSearch(snapshot, 'req-a', scaleQuantity)
    const b = runGenerationSearch(snapshot, 'req-b', scaleQuantity)
    expect(a.fingerprint).toBe(b.fingerprint)
    expect(a.assignments).toEqual(b.assignments)
    expect(a.algorithmVersion).toBe('30')
  })

  it('uses a per-slot quantity override', () => {
    const proposal = runGenerationSearch(
      input({
        quantityOverrides: { 'slot-dinner': { value: 9, unit: 'serving' } },
      }),
      'req-1',
      scaleQuantity,
    )
    expect(proposal.assignments[0].outputQuantity).toEqual({ value: 9, unit: 'serving' })
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
    expect(proposal.assignments[0].recipeId).toBe('rice')
    expect(proposal.diagnostics.fixedConflicts[0]).toMatchObject({
      slotId: 'slot-mon',
      reasons: ['exclude-ingredients'],
    })
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
})
