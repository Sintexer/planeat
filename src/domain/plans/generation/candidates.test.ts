import { describe, expect, it } from 'vitest'
import type { Recipe } from '../../recipes/Recipe'
import type { MealSlot } from '../MealSlot'
import { eligibleStandaloneRecipes, isStandaloneEligible, selectFirstCandidate } from './candidates'
import { fingerprintFromInput, type GenerationInput } from './proposal'

function recipe(overrides: Partial<Recipe>): Recipe {
  return {
    id: 'r1',
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
    slot: slot(),
    slotComponentCount: 0,
    recipes: [],
    ...overrides,
  }
}

describe('eligibleStandaloneRecipes', () => {
  it('requires complete and the slot occasion', () => {
    const completeDinner = recipe({ id: 'a', roles: ['complete'], mealTypes: ['dinner'] })
    const mainDinner = recipe({ id: 'b', roles: ['main'], mealTypes: ['dinner'] })
    const completeLunch = recipe({ id: 'c', roles: ['complete'], mealTypes: ['lunch'] })
    const both = recipe({
      id: 'd',
      roles: ['complete', 'main'],
      mealTypes: ['lunch', 'dinner'],
    })
    expect(isStandaloneEligible(mainDinner, 'dinner')).toBe(false)
    expect(
      eligibleStandaloneRecipes([completeDinner, mainDinner, completeLunch, both], 'dinner'),
    ).toEqual([completeDinner, both])
  })

  it('sorts by id then name and picks the first', () => {
    const laterId = recipe({ id: 'z-soup', name: 'Aaa' })
    const earlierId = recipe({ id: 'a-stew', name: 'Zzz' })
    const eligible = eligibleStandaloneRecipes([laterId, earlierId], 'dinner')
    expect(eligible.map((row) => row.id)).toEqual(['a-stew', 'z-soup'])
    expect(selectFirstCandidate(eligible)?.id).toBe('a-stew')
  })
})

describe('fingerprintFromInput', () => {
  const soup = recipe({ id: 'soup', updatedAt: 10 })

  it('changes when an eligible recipe is edited', () => {
    const before = fingerprintFromInput(input({ recipes: [soup] }))
    const after = fingerprintFromInput(input({ recipes: [{ ...soup, updatedAt: 11 }] }))
    expect(before).not.toBe(after)
  })

  it('changes when plan revision or household size changes', () => {
    const base = fingerprintFromInput(input({ recipes: [soup], planRevision: 1, peopleCount: 2 }))
    expect(
      fingerprintFromInput(input({ recipes: [soup], planRevision: 2, peopleCount: 2 })),
    ).not.toBe(base)
    expect(
      fingerprintFromInput(input({ recipes: [soup], planRevision: 1, peopleCount: 4 })),
    ).not.toBe(base)
  })

  it('ignores ineligible recipes', () => {
    const side = recipe({ id: 'side', roles: ['side'], updatedAt: 99 })
    const withSide = fingerprintFromInput(input({ recipes: [soup, side] }))
    const without = fingerprintFromInput(input({ recipes: [soup] }))
    expect(withSide).toBe(without)
  })
})
