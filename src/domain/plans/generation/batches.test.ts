import { describe, expect, it } from 'vitest'
import type { Recipe } from '../../recipes/Recipe'
import { scaleQuantity } from '../../shared/scaleQuantity'
import type { MealSlot } from '../MealSlot'
import { DEFAULT_GENERATION_HARD_POLICY } from './constraints'
import type { GenerationInput } from './proposal'
import { DEFAULT_GENERATION_SOFT_PREFS } from './scoring'
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
  const chili = recipe()
  return {
    planId: 'plan-1',
    planRevision: 1,
    peopleCount: 2,
    recipes: [chili],
    requestedSlots: [
      { slot: slot(), componentCount: 0 },
      { slot: slot({ id: 'slot-tue', date: '2026-01-06' }), componentCount: 0 },
    ],
    seed: 'seed-1',
    policy: DEFAULT_GENERATION_HARD_POLICY,
    fixedMeals: [],
    catalogs: { recipeIds: ['chili'], tagIds: [], ingredientIds: [] },
    softPrefs: DEFAULT_GENERATION_SOFT_PREFS,
    previousWeekRecipeIds: [],
    tagNamesById: {},
    batchPolicy: { maxExtraPlannedUses: 1, unallocatedProduction: 'disallow' },
    ...overrides,
  }
}

function cookCount(proposal: ReturnType<typeof runGenerationSearch>): number {
  return proposal.assignments.filter((row) =>
    row.components.some((component) => component.type === 'recipe'),
  ).length
}

describe('planned batch generation', () => {
  it('cooks once for Monday and Tuesday dinners', () => {
    const proposal = runGenerationSearch(input(), 'req-1', scaleQuantity)
    expect(proposal.algorithmVersion).toBe('35')
    expect(proposal.assignments).toHaveLength(2)
    expect(proposal.unfilled).toHaveLength(0)
    expect(cookCount(proposal)).toBe(1)
    const producer = proposal.assignments.find((row) =>
      row.components.some((component) => component.type === 'recipe'),
    )
    const leftover = proposal.assignments.find((row) =>
      row.components.some((component) => component.type === 'leftover'),
    )
    const recipeComponent = producer?.components.find((component) => component.type === 'recipe')
    expect(recipeComponent).toMatchObject({
      type: 'recipe',
      outputQuantity: { value: 4, unit: 'serving' },
      allocatedQuantity: { value: 2, unit: 'serving' },
    })
    expect(recipeComponent?.type === 'recipe' && recipeComponent.proposedEventId).toBeTruthy()
    expect(leftover?.components[0]).toMatchObject({
      type: 'leftover',
      allocatedQuantity: { value: 2, unit: 'serving' },
      proposedEventId: recipeComponent?.type === 'recipe' ? recipeComponent.proposedEventId : '',
    })
    expect(proposal.proposedCookingEvents).toHaveLength(1)
    expect(proposal.diagnostics.unallocatedRemainders ?? []).toHaveLength(0)
  })

  it('does not invent next-day reuse for fresh-only recipes', () => {
    const proposal = runGenerationSearch(
      input({
        recipes: [recipe({ reusePolicy: 'fresh-only' })],
      }),
      'req-1',
      scaleQuantity,
    )
    expect(cookCount(proposal)).toBe(2)
    expect(
      proposal.assignments.every((row) =>
        row.components.every(
          (component) => component.type !== 'leftover' || !component.proposedEventId,
        ),
      ),
    ).toBe(true)
  })

  it('does not over-allocate proposed remaining across later slots', () => {
    const proposal = runGenerationSearch(
      input({
        requestedSlots: [
          { slot: slot(), componentCount: 0 },
          { slot: slot({ id: 'slot-tue', date: '2026-01-06' }), componentCount: 0 },
          { slot: slot({ id: 'slot-wed', date: '2026-01-07' }), componentCount: 0 },
        ],
      }),
      'req-1',
      scaleQuantity,
    )
    expect(proposal.assignments).toHaveLength(3)
    const leftoverAllocations = proposal.assignments.flatMap((row) =>
      row.components.flatMap((component) =>
        component.type === 'leftover' && component.proposedEventId
          ? [component.allocatedQuantity.value]
          : [],
      ),
    )
    expect(leftoverAllocations.reduce((sum, value) => sum + value, 0)).toBe(2)
    expect(cookCount(proposal)).toBe(2)
  })

  it('keeps this-meal-only behavior when extra uses are zero', () => {
    const proposal = runGenerationSearch(
      input({ batchPolicy: { maxExtraPlannedUses: 0, unallocatedProduction: 'disallow' } }),
      'req-1',
      scaleQuantity,
    )
    expect(cookCount(proposal)).toBe(2)
    expect(proposal.proposedCookingEvents ?? []).toHaveLength(0)
  })

  it('disallow does not keep a too-large extra that cannot be used', () => {
    const stew = recipe({ id: 'stew', name: 'Stew' })
    const chili = recipe()
    const proposal = runGenerationSearch(
      input({
        recipes: [chili, stew],
        catalogs: { recipeIds: ['chili', 'stew'], tagIds: [], ingredientIds: [] },
        quantityOverrides: { 'slot-tue': { value: 1, unit: 'piece' } },
        batchPolicy: { maxExtraPlannedUses: 1, unallocatedProduction: 'disallow' },
      }),
      'req-1',
      scaleQuantity,
    )
    expect(proposal.diagnostics.unallocatedRemainders ?? []).toHaveLength(0)
    const extras = proposal.assignments.flatMap((row) =>
      row.components.filter(
        (component) =>
          component.type === 'recipe' &&
          component.outputQuantity.value > component.allocatedQuantity.value,
      ),
    )
    expect(extras).toHaveLength(0)
  })

  it('allow-with-warning can keep remainder and report it', () => {
    const proposal = runGenerationSearch(
      input({
        quantityOverrides: { 'slot-tue': { value: 1, unit: 'serving' } },
        batchPolicy: { maxExtraPlannedUses: 1, unallocatedProduction: 'allow-with-warning' },
        searchBudget: { beamWidth: 8, perSlotCandidateLimit: 8, expansionBudget: 400 },
      }),
      'req-1',
      scaleQuantity,
    )
    expect(proposal.assignments).toHaveLength(2)
    const remainders = proposal.diagnostics.unallocatedRemainders ?? []
    expect(remainders.length).toBeGreaterThan(0)
    expect(remainders[0]?.remaining).toEqual({ value: 1, unit: 'serving' })
  })
})
