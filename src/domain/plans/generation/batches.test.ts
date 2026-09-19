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

function starterCutletsInput(
  slotCount: 2 | 3,
  batchPolicy?: GenerationInput['batchPolicy'],
): GenerationInput {
  const cutlets = recipe({
    id: 'cutlets',
    name: 'Chicken cutlets',
    yield: { value: 12, unit: 'piece' },
    defaultPortionPerPerson: { value: 3, unit: 'piece' },
    roles: ['main'],
    mealTypes: ['lunch', 'dinner'],
  })
  const rice = recipe({
    id: 'rice',
    name: 'Rice',
    roles: ['side'],
    effort: 'quick',
    reusePolicy: 'same-day',
    mealTypes: ['lunch', 'dinner'],
  })
  const buckwheat = recipe({
    id: 'buckwheat',
    name: 'Buckwheat',
    roles: ['side'],
    effort: 'quick',
    reusePolicy: 'same-day',
    mealTypes: ['lunch', 'dinner'],
  })
  const potatoes = recipe({
    id: 'potatoes',
    name: 'Potatoes',
    roles: ['side', 'vegetable'],
    effort: 'quick',
    reusePolicy: 'same-day',
    mealTypes: ['lunch', 'dinner'],
  })
  const requestedSlots = [
    { slot: slot({ id: 'slot-mon', date: '2026-01-05', mealType: 'lunch' }), componentCount: 0 },
    { slot: slot({ id: 'slot-tue', date: '2026-01-05', mealType: 'dinner' }), componentCount: 0 },
    { slot: slot({ id: 'slot-wed', date: '2026-01-06', mealType: 'lunch' }), componentCount: 0 },
  ].slice(0, slotCount)
  return input({
    recipes: [cutlets, rice, buckwheat, potatoes],
    catalogs: {
      recipeIds: ['cutlets', 'rice', 'buckwheat', 'potatoes'],
      tagIds: [],
      ingredientIds: [],
    },
    requestedSlots,
    pairings: [
      {
        id: 'pair-rice',
        recipeId: 'cutlets',
        target: { type: 'recipe', id: 'rice' },
        relationship: 'pairs-with',
      },
      {
        id: 'pair-buckwheat',
        recipeId: 'cutlets',
        target: { type: 'recipe', id: 'buckwheat' },
        relationship: 'pairs-with',
      },
      {
        id: 'pair-potatoes',
        recipeId: 'cutlets',
        target: { type: 'recipe', id: 'potatoes' },
        relationship: 'pairs-with',
      },
    ],
    batchPolicy: batchPolicy ?? { maxExtraPlannedUses: 2, unallocatedProduction: 'disallow' },
    searchBudget: { beamWidth: 8, perSlotCandidateLimit: 16, expansionBudget: 800 },
  })
}

describe('planned batch generation', () => {
  it('cooks once for Monday and Tuesday dinners', () => {
    const proposal = runGenerationSearch(input(), 'req-1', scaleQuantity)
    expect(proposal.algorithmVersion).toBe('41')
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
        recipes: [recipe({ yield: { value: 2, unit: 'serving' } })],
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

  it('keeps this-meal-only behavior when extra uses are zero and yield is one meal', () => {
    const proposal = runGenerationSearch(
      input({
        recipes: [recipe({ yield: { value: 2, unit: 'serving' } })],
        batchPolicy: { maxExtraPlannedUses: 0, unallocatedProduction: 'disallow' },
      }),
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

  it('cooks cutlets once and plates later leftover meals with different sides', () => {
    const cutlets = recipe({
      id: 'cutlets',
      name: 'Cutlets',
      roles: ['main'],
      mealTypes: ['lunch', 'dinner'],
    })
    const rice = recipe({
      id: 'rice',
      name: 'Rice',
      roles: ['side'],
      effort: 'quick',
      reusePolicy: 'same-day',
      mealTypes: ['lunch', 'dinner'],
    })
    const buckwheat = recipe({
      id: 'buckwheat',
      name: 'Buckwheat',
      roles: ['side'],
      effort: 'quick',
      reusePolicy: 'same-day',
      mealTypes: ['lunch', 'dinner'],
    })
    const potatoes = recipe({
      id: 'potatoes',
      name: 'Potatoes',
      roles: ['side', 'vegetable'],
      effort: 'quick',
      reusePolicy: 'same-day',
      mealTypes: ['lunch', 'dinner'],
    })
    const proposal = runGenerationSearch(
      input({
        recipes: [cutlets, rice, buckwheat, potatoes],
        catalogs: {
          recipeIds: ['cutlets', 'rice', 'buckwheat', 'potatoes'],
          tagIds: [],
          ingredientIds: [],
        },
        requestedSlots: [
          { slot: slot({ id: 'slot-mon', date: '2026-01-05' }), componentCount: 0 },
          { slot: slot({ id: 'slot-tue', date: '2026-01-06' }), componentCount: 0 },
          { slot: slot({ id: 'slot-wed', date: '2026-01-07' }), componentCount: 0 },
        ],
        pairings: [
          {
            id: 'pair-rice',
            recipeId: 'cutlets',
            target: { type: 'recipe', id: 'rice' },
            relationship: 'pairs-with',
          },
          {
            id: 'pair-buckwheat',
            recipeId: 'cutlets',
            target: { type: 'recipe', id: 'buckwheat' },
            relationship: 'pairs-with',
          },
          {
            id: 'pair-potatoes',
            recipeId: 'cutlets',
            target: { type: 'recipe', id: 'potatoes' },
            relationship: 'pairs-with',
          },
        ],
        batchPolicy: { maxExtraPlannedUses: 2, unallocatedProduction: 'disallow' },
        searchBudget: { beamWidth: 8, perSlotCandidateLimit: 16, expansionBudget: 800 },
      }),
      'req-1',
      scaleQuantity,
    )
    expect(proposal.assignments).toHaveLength(3)
    expect(proposal.unfilled).toHaveLength(0)
    const cutletCooks = proposal.assignments.flatMap((row) =>
      row.components.filter(
        (component) => component.type === 'recipe' && component.recipeId === 'cutlets',
      ),
    )
    expect(cutletCooks).toHaveLength(1)
    expect(cutletCooks[0]).toMatchObject({
      outputQuantity: { value: 6, unit: 'serving' },
      allocatedQuantity: { value: 2, unit: 'serving' },
    })
    const leftoverCutlets = proposal.assignments.filter((row) =>
      row.components.some(
        (component) => component.type === 'leftover' && component.recipeId === 'cutlets',
      ),
    )
    expect(leftoverCutlets).toHaveLength(2)
    const sideIds = proposal.assignments.map((row) => {
      const side = row.components.find(
        (component) =>
          (component.type === 'recipe' || component.type === 'leftover') &&
          component.recipeId !== 'cutlets',
      )
      return side && 'recipeId' in side ? side.recipeId : undefined
    })
    expect(new Set(sideIds).size).toBe(3)
  })

  it('cooks starter cutlets once at 18 piece for three meals', () => {
    const proposal = runGenerationSearch(starterCutletsInput(3), 'req-1', scaleQuantity)
    expect(proposal.assignments).toHaveLength(3)
    expect(proposal.unfilled).toHaveLength(0)
    const cutletCooks = proposal.assignments.flatMap((row) =>
      row.components.filter(
        (component) => component.type === 'recipe' && component.recipeId === 'cutlets',
      ),
    )
    expect(cutletCooks).toHaveLength(1)
    expect(cutletCooks[0]).toMatchObject({
      outputQuantity: { value: 18, unit: 'piece' },
      allocatedQuantity: { value: 6, unit: 'piece' },
    })
    const leftoverCutlets = proposal.assignments.filter((row) =>
      row.components.some(
        (component) => component.type === 'leftover' && component.recipeId === 'cutlets',
      ),
    )
    expect(leftoverCutlets).toHaveLength(2)
  })

  it('cooks starter cutlets once at yield 12 piece for two meals', () => {
    const proposal = runGenerationSearch(starterCutletsInput(2), 'req-1', scaleQuantity)
    const cutletCooks = proposal.assignments.flatMap((row) =>
      row.components.filter(
        (component) => component.type === 'recipe' && component.recipeId === 'cutlets',
      ),
    )
    expect(proposal.assignments).toHaveLength(2)
    expect(cutletCooks).toHaveLength(1)
    expect(cutletCooks[0]).toMatchObject({
      outputQuantity: { value: 12, unit: 'piece' },
      allocatedQuantity: { value: 6, unit: 'piece' },
    })
  })

  it('fills cutlet yield when extra uses are zero and a later leftover slot exists', () => {
    const proposal = runGenerationSearch(
      starterCutletsInput(2, { maxExtraPlannedUses: 0, unallocatedProduction: 'disallow' }),
      'req-1',
      scaleQuantity,
    )
    const cutletCooks = proposal.assignments.flatMap((row) =>
      row.components.filter(
        (component) => component.type === 'recipe' && component.recipeId === 'cutlets',
      ),
    )
    expect(cutletCooks).toHaveLength(1)
    expect(cutletCooks[0]).toMatchObject({
      outputQuantity: { value: 12, unit: 'piece' },
      allocatedQuantity: { value: 6, unit: 'piece' },
    })
  })

  it('batches soup across meals instead of recooking carbonara each day', () => {
    const soup = recipe({
      id: 'soup',
      name: 'Vegetable soup',
      mealTypes: ['lunch', 'dinner'],
    })
    const carbonara = recipe({
      id: 'carbonara',
      name: 'Carbonara',
      mealTypes: ['lunch', 'dinner'],
      effort: 'quick',
      reusePolicy: 'fresh-only',
    })
    const proposal = runGenerationSearch(
      input({
        recipes: [soup, carbonara],
        catalogs: { recipeIds: ['soup', 'carbonara'], tagIds: [], ingredientIds: [] },
        requestedSlots: [
          {
            slot: slot({ id: 'slot-mon-lunch', date: '2026-01-05', mealType: 'lunch' }),
            componentCount: 0,
          },
          {
            slot: slot({ id: 'slot-mon-dinner', date: '2026-01-05', mealType: 'dinner' }),
            componentCount: 0,
          },
          {
            slot: slot({ id: 'slot-tue-lunch', date: '2026-01-06', mealType: 'lunch' }),
            componentCount: 0,
          },
        ],
        batchPolicy: { maxExtraPlannedUses: 2, unallocatedProduction: 'disallow' },
        searchBudget: { beamWidth: 8, perSlotCandidateLimit: 8, expansionBudget: 400 },
      }),
      'req-1',
      scaleQuantity,
    )
    const soupCooks = proposal.assignments.filter((row) =>
      row.components.some(
        (component) => component.type === 'recipe' && component.recipeId === 'soup',
      ),
    )
    const soupLeftovers = proposal.assignments.filter((row) =>
      row.components.some(
        (component) => component.type === 'leftover' && component.recipeId === 'soup',
      ),
    )
    expect(soupCooks).toHaveLength(1)
    expect(soupLeftovers.length).toBeGreaterThanOrEqual(1)
    expect(cookCount(proposal)).toBeLessThan(3)
  })
})
