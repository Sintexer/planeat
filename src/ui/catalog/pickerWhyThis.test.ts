import { describe, expect, it } from 'vitest'
import type { MealFavorite } from '../../domain/favorites/MealFavorite'
import type { RecipePairing } from '../../domain/pairings/RecipePairing'
import type { CookingEvent } from '../../domain/plans/CookingEvent'
import type { PlanGraph } from '../../domain/plans/PlanGraph'
import {
  isPlannedThisWeek,
  leftoverBatchSubtitle,
  matchingFavoriteName,
  pairingPartnerName,
  pickerWhyThisCopy,
} from './pickerWhyThis'

describe('leftoverBatchSubtitle', () => {
  it('names the weekday of the scheduled prep date', () => {
    expect(leftoverBatchSubtitle('2026-09-14')).toBe("Uses Monday's batch")
    expect(leftoverBatchSubtitle('2026-09-16')).toBe("Uses Wednesday's batch")
  })
})

describe('pickerWhyThisCopy', () => {
  it('explains a pairing with the partner name when present', () => {
    expect(
      pickerWhyThisCopy({
        kind: 'recipe',
        reason: 'pairing',
        pairingPartnerName: 'rice',
      }),
    ).toBe('Often paired with rice')
  })

  it('explains a favorite by name when present', () => {
    expect(
      pickerWhyThisCopy({
        kind: 'recipe',
        reason: 'favorite',
        favoriteName: 'Cutlets dinner',
      }),
    ).toBe('From favorite Cutlets dinner')
  })

  it('explains already-planned-this-week when that is the only signal', () => {
    expect(
      pickerWhyThisCopy({
        kind: 'recipe',
        reason: 'other',
        plannedThisWeek: true,
      }),
    ).toBe('Already planned this week')
  })

  it('prefers pairing copy over planned-this-week', () => {
    expect(
      pickerWhyThisCopy({
        kind: 'recipe',
        reason: 'pairing',
        pairingPartnerName: 'rice',
        plannedThisWeek: true,
      }),
    ).toBe('Often paired with rice')
  })

  it('falls back to kind when no why-this signal exists', () => {
    expect(pickerWhyThisCopy({ kind: 'recipe', reason: 'role' })).toBe('Recipe')
    expect(pickerWhyThisCopy({ kind: 'simple-food', reason: 'other' })).toBe('Simple food')
  })
})

describe('pairingPartnerName', () => {
  const pairings: RecipePairing[] = [
    {
      id: 'p1',
      recipeId: 'cutlets',
      target: { type: 'recipe', id: 'rice' },
      relationship: 'pairs-with',
    },
  ]
  const recipeNamesById = new Map([
    ['cutlets', 'Cutlets'],
    ['rice', 'Rice'],
  ])

  it('names the current-slot recipe the candidate is paired with', () => {
    expect(
      pairingPartnerName({
        candidateKind: 'recipe',
        candidateId: 'rice',
        currentRecipeIds: new Set(['cutlets']),
        pairings,
        recipeNamesById,
      }),
    ).toBe('Cutlets')
  })
})

describe('matchingFavoriteName', () => {
  const favorites: MealFavorite[] = [
    {
      id: 'f1',
      name: 'Cutlets dinner',
      createdAt: 1,
      updatedAt: 1,
      components: [
        {
          type: 'recipe',
          recipeId: 'cutlets',
          allocatedQuantity: { value: 1, unit: 'piece' },
        },
        {
          type: 'recipe',
          recipeId: 'rice',
          allocatedQuantity: { value: 1, unit: 'serving' },
        },
      ],
    },
  ]

  it('returns the favorite that contains both the current slot recipe and the candidate', () => {
    expect(
      matchingFavoriteName({
        candidateKind: 'recipe',
        candidateId: 'rice',
        currentRecipeIds: new Set(['cutlets']),
        favorites,
      }),
    ).toBe('Cutlets dinner')
  })
})

describe('isPlannedThisWeek', () => {
  const graph: PlanGraph = {
    plan: {
      id: 'plan',
      startDate: '2026-09-14',
      dayCount: 7,
      peopleCount: 2,
      revision: 1,
      preferences: {},
      createdAt: 1,
      updatedAt: 1,
    },
    slots: [],
    components: [
      {
        id: 'c1',
        slotId: 's1',
        source: { type: 'simple-food', simpleFoodId: 'yogurt' },
        allocatedQuantity: { value: 1, unit: 'serving' },
      },
    ],
    cookingEvents: [{ recipeId: 'soup' } as CookingEvent],
    prepSessions: [],
  }

  it('detects recipes from cooking events and simple foods from components', () => {
    expect(isPlannedThisWeek('recipe', 'soup', graph)).toBe(true)
    expect(isPlannedThisWeek('recipe', 'other', graph)).toBe(false)
    expect(isPlannedThisWeek('simple-food', 'yogurt', graph)).toBe(true)
    expect(isPlannedThisWeek('simple-food', 'apple', graph)).toBe(false)
  })
})
