import { describe, expect, it } from 'vitest'
import type { Recipe } from '../../recipes/Recipe'
import { scaleQuantity } from '../../shared/scaleQuantity'
import type { SimpleFood } from '../../simpleFoods/SimpleFood'
import type { MealSlot } from '../MealSlot'
import { DEFAULT_GENERATION_HARD_POLICY } from './constraints'
import { generationInvariantIssues } from './invariants'
import type { GenerationInput, WeekGenerationProposal } from './proposal'
import { DEFAULT_GENERATION_SOFT_PREFS } from './scoring'
import { runGenerationSearch } from './search'

const PLAN = 'plan-weeks'

function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'chili',
    name: 'Chili',
    yield: { value: 12, unit: 'serving' },
    defaultPortionPerPerson: { value: 1, unit: 'serving' },
    ingredientLines: [],
    instructions: '',
    roles: ['complete'],
    mealTypes: ['dinner'],
    effort: 'regular',
    totalTimeMinutes: 40,
    reusePolicy: 'batch-friendly',
    freezerFriendly: false,
    tagIds: [],
    createdAt: 0,
    updatedAt: 10,
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
    mealTypes: ['lunch', 'dinner'],
    tagIds: [],
    enabledInSuggestions: true,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

function slot(day: number, mealType: MealSlot['mealType'], id?: string): MealSlot {
  const date = `2026-01-${String(5 + day).padStart(2, '0')}`
  return {
    id: id ?? `slot-${mealType}-${day}`,
    planId: PLAN,
    date,
    mealType,
    excluded: false,
  }
}

function base(overrides: Partial<GenerationInput> & { recipes: Recipe[] }): GenerationInput {
  const recipes = overrides.recipes
  const foods = overrides.simpleFoods ?? []
  return {
    planId: PLAN,
    planRevision: 1,
    peopleCount: 2,
    requestedSlots: [],
    seed: 'seed-1',
    policy: DEFAULT_GENERATION_HARD_POLICY,
    fixedMeals: [],
    catalogs: {
      recipeIds: recipes.map((item) => item.id),
      tagIds: [],
      ingredientIds: foods.map((item) => item.ingredientId),
    },
    softPrefs: DEFAULT_GENERATION_SOFT_PREFS,
    previousWeekRecipeIds: [],
    tagNamesById: {},
    batchPolicy: { maxExtraPlannedUses: 1, unallocatedProduction: 'disallow' },
    searchBudget: { beamWidth: 8, perSlotCandidateLimit: 8, expansionBudget: 400 },
    ...overrides,
  }
}

function run(input: GenerationInput): WeekGenerationProposal {
  return runGenerationSearch(input, 'req-week', scaleQuantity)
}

function recipeIdOf(
  component: WeekGenerationProposal['assignments'][number]['components'][number],
): string {
  return component.type === 'simple-food' ? component.simpleFoodId : component.recipeId
}

function isCutlets(
  component: WeekGenerationProposal['assignments'][number]['components'][number],
): boolean {
  return component.type !== 'simple-food' && component.recipeId === 'cutlets'
}

function newCooksOn(proposal: WeekGenerationProposal, date: string, slots: readonly MealSlot[]) {
  const ids = new Set(slots.filter((row) => row.date === date).map((row) => row.id))
  return proposal.assignments
    .filter((row) => ids.has(row.slotId))
    .flatMap((row) => row.components)
    .filter((component) => component.type === 'recipe')
}

describe('representative generation weeks', () => {
  it('plans a normal mixed catalog with exact batches and complete plates', () => {
    const chili = recipe()
    const stew = recipe({ id: 'stew', name: 'Stew', yield: { value: 8, unit: 'serving' } })
    const pasta = recipe({
      id: 'pasta',
      name: 'Pasta',
      mealTypes: ['lunch', 'dinner'],
      effort: 'quick',
      reusePolicy: 'fresh-only',
      totalTimeMinutes: 20,
    })
    const cutlets = recipe({
      id: 'cutlets',
      name: 'Cutlets',
      roles: ['main'],
      yield: { value: 12, unit: 'piece' },
      defaultPortionPerPerson: { value: 1, unit: 'piece' },
    })
    const potatoes = recipe({
      id: 'potatoes',
      name: 'Potatoes',
      roles: ['side'],
      effort: 'quick',
      reusePolicy: 'fresh-only',
      totalTimeMinutes: 20,
    })
    const rice = recipe({
      id: 'rice',
      name: 'Rice',
      roles: ['side'],
      effort: 'quick',
      reusePolicy: 'fresh-only',
      totalTimeMinutes: 15,
    })
    const roast = recipe({
      id: 'roast',
      name: 'Roast',
      effort: 'demanding',
      totalTimeMinutes: 90,
    })
    const yogurt = food()
    const dinners = [0, 1, 2, 3, 4].map((day) => slot(day, 'dinner'))
    const lunches = [0, 1, 2, 3, 4].map((day) => slot(day, 'lunch'))
    const slots = [...lunches, ...dinners]
    const input = base({
      recipes: [chili, stew, pasta, cutlets, potatoes, rice, roast],
      simpleFoods: [yogurt],
      pairings: [
        {
          id: 'pair-potatoes',
          recipeId: 'cutlets',
          target: { type: 'recipe', id: 'potatoes' },
          relationship: 'pairs-with',
        },
        {
          id: 'pair-rice',
          recipeId: 'cutlets',
          target: { type: 'recipe', id: 'rice' },
          relationship: 'pairs-with',
        },
      ],
      requestedSlots: slots.map((row) => ({ slot: row, componentCount: 0 })),
      softPrefs: { ...DEFAULT_GENERATION_SOFT_PREFS, quickMealsOnlyDays: [3, 5] },
      catalogs: {
        recipeIds: [chili, stew, pasta, cutlets, potatoes, rice, roast].map((item) => item.id),
        tagIds: [],
        ingredientIds: [yogurt.ingredientId],
      },
    })
    const proposal = run(input)
    expect(generationInvariantIssues(input, proposal)).toEqual([])
    expect(proposal.unfilled).toEqual([])
    expect(proposal.preparationSummary?.length).toBeGreaterThan(0)

    for (const event of proposal.proposedCookingEvents ?? []) {
      const eaten = proposal.assignments.flatMap((row) =>
        row.components.filter(
          (component) =>
            (component.type === 'recipe' || component.type === 'leftover') &&
            component.proposedEventId === event.id,
        ),
      )
      const sum = eaten.reduce((total, component) => total + component.allocatedQuantity.value, 0)
      expect(event.outputQuantity.value).toBeCloseTo(sum)
      expect(event.outputQuantity.value).not.toBe(12)
    }

    const grouped = (proposal.proposedCookingEvents ?? []).some((event) => {
      const meals = proposal.assignments.filter((row) =>
        row.components.some(
          (component) =>
            (component.type === 'recipe' || component.type === 'leftover') &&
            component.proposedEventId === event.id,
        ),
      )
      return meals.length >= 2
    })
    expect(grouped).toBe(true)

    for (const day of [2, 4]) {
      const date = `2026-01-${String(5 + day).padStart(2, '0')}`
      const cooks = newCooksOn(proposal, date, slots)
      expect(cooks.every((component) => component.type === 'recipe')).toBe(true)
      const demanding = cooks.filter((component) => component.recipeId === 'roast')
      expect(demanding).toEqual([])
      const heavySide = cooks.filter((component) => component.recipeId === 'cutlets')
      expect(heavySide).toEqual([])
    }

    for (const assignment of proposal.assignments) {
      const mains = assignment.components.filter(
        (component) => component.role === 'main' || isCutlets(component),
      )
      if (mains.length === 0) continue
      expect(assignment.components.length).toBeGreaterThan(1)
    }

    const dinnerPlates = proposal.assignments
      .filter((row) => dinners.some((dinner) => dinner.id === row.slotId))
      .map((row) => ({
        main: row.components.find((component) => isCutlets(component) || component.role === 'main')
          ? 'cutlets'
          : undefined,
        plate: row.components.map(recipeIdOf).sort().join('+'),
      }))
      .filter((row) => row.main)
    const byMain = new Map<string, string[]>()
    for (const plate of dinnerPlates) {
      if (!plate.main) continue
      byMain.set(plate.main, [...(byMain.get(plate.main) ?? []), plate.plate])
    }
    for (const plates of byMain.values()) {
      if (plates.length < 2) continue
      expect(new Set(plates).size).toBeGreaterThan(1)
    }

    const dinnerMains = new Set(
      proposal.assignments
        .filter((row) => dinners.some((dinner) => dinner.id === row.slotId))
        .flatMap((row) => row.components.map(recipeIdOf)),
    )
    expect(dinnerMains.size).toBeGreaterThan(1)
  })

  it('fills a small catalog without inflating yield', () => {
    const chili = recipe()
    const slots = [0, 1, 2].map((day) => slot(day, 'dinner'))
    const input = base({
      recipes: [chili],
      requestedSlots: slots.map((row) => ({ slot: row, componentCount: 0 })),
    })
    const proposal = run(input)
    expect(generationInvariantIssues(input, proposal)).toEqual([])
    expect(proposal.assignments).toHaveLength(3)
    const event = proposal.proposedCookingEvents?.[0]
    expect(event?.outputQuantity).toEqual({ value: 4, unit: 'serving' })
    expect(
      proposal.assignments.filter((row) =>
        row.components.some((component) => component.type === 'recipe'),
      ),
    ).toHaveLength(2)
  })

  it('keeps busy days simpler than the free-day batch', () => {
    const stew = recipe({ id: 'stew', name: 'Stew', effort: 'demanding', totalTimeMinutes: 80 })
    const eggs = recipe({
      id: 'eggs',
      name: 'Eggs',
      effort: 'quick',
      totalTimeMinutes: 10,
      reusePolicy: 'fresh-only',
    })
    const yogurt = food({ mealTypes: ['dinner'] })
    const slots = [0, 1, 2, 3, 4].map((day) => slot(day, 'dinner'))
    const input = base({
      recipes: [stew, eggs],
      simpleFoods: [yogurt],
      requestedSlots: slots.map((row) => ({ slot: row, componentCount: 0 })),
      softPrefs: { ...DEFAULT_GENERATION_SOFT_PREFS, quickMealsOnlyDays: [0, 2, 3, 4, 5, 6] },
      catalogs: {
        recipeIds: ['stew', 'eggs'],
        tagIds: [],
        ingredientIds: [yogurt.ingredientId],
      },
    })
    const proposal = run(input)
    expect(generationInvariantIssues(input, proposal)).toEqual([])
    const monday = proposal.assignments.find((row) => row.slotId === 'slot-dinner-0')
    expect(
      monday?.components.some(
        (component) => component.type === 'recipe' && component.recipeId === 'stew',
      ),
    ).toBe(true)
    expect(
      proposal.assignments.some((row) =>
        row.components.some(
          (component) => component.type === 'leftover' && component.recipeId === 'stew',
        ),
      ),
    ).toBe(true)
    for (const day of [1, 2, 3, 4]) {
      const cooks = newCooksOn(proposal, slots[day].date, slots)
      expect(cooks.some((component) => component.recipeId === 'stew')).toBe(false)
    }
  })

  it('cooks each meal alone when no extra uses are requested', () => {
    const chili = recipe()
    const stew = recipe({ id: 'stew', name: 'Stew' })
    const slots = [0, 1, 2, 3].map((day) => slot(day, 'dinner'))
    const input = base({
      recipes: [chili, stew],
      requestedSlots: slots.map((row) => ({ slot: row, componentCount: 0 })),
      batchPolicy: { maxExtraPlannedUses: 0, unallocatedProduction: 'disallow' },
    })
    const proposal = run(input)
    expect(generationInvariantIssues(input, proposal)).toEqual([])
    expect(proposal.proposedCookingEvents ?? []).toEqual([])
    expect(
      proposal.assignments.every((row) =>
        row.components.every((component) => component.type !== 'leftover'),
      ),
    ).toBe(true)
    for (const assignment of proposal.assignments) {
      for (const component of assignment.components) {
        if (component.type !== 'recipe') continue
        expect(component.outputQuantity).toEqual(component.allocatedQuantity)
      }
    }
  })

  it('uses a third meal when the household allows more batch reuse', () => {
    const chili = recipe()
    const slots = [0, 1, 2].map((day) => slot(day, 'dinner'))
    const input = base({
      recipes: [chili],
      requestedSlots: slots.map((row) => ({ slot: row, componentCount: 0 })),
      batchPolicy: { maxExtraPlannedUses: 2, unallocatedProduction: 'disallow' },
    })
    const proposal = run(input)
    expect(generationInvariantIssues(input, proposal)).toEqual([])
    const event = proposal.proposedCookingEvents?.find((row) => row.outputQuantity.value === 6)
    expect(event).toBeTruthy()
    const meals = proposal.assignments.filter((row) =>
      row.components.some(
        (component) =>
          (component.type === 'recipe' || component.type === 'leftover') &&
          component.proposedEventId === event?.id,
      ),
    )
    expect(meals).toHaveLength(3)
    expect(
      proposal.preparationSummary?.some(
        (line) => line.action === 'cook-for' && line.dates.length >= 2,
      ),
    ).toBe(true)
  })

  it('uses existing leftovers without taking portions reserved for fixed meals', () => {
    const chili = recipe({ id: 'chili', name: 'Chili' })
    const stew = recipe({ id: 'stew', name: 'Stew' })
    const wednesday = slot(2, 'dinner', 'slot-wed')
    const thursday = slot(3, 'dinner', 'slot-thu')
    const friday = slot(4, 'dinner', 'slot-fri')
    const input = base({
      recipes: [chili, stew],
      requestedSlots: [wednesday, thursday, friday].map((row) => ({
        slot: row,
        componentCount: 0,
      })),
      fixedMeals: [
        {
          slotId: 'slot-mon',
          date: '2026-01-05',
          mealType: 'dinner',
          recipeId: chili.id,
          recipe: chili,
        },
        {
          slotId: 'slot-tue',
          date: '2026-01-06',
          mealType: 'dinner',
          recipeId: stew.id,
          recipe: stew,
        },
      ],
      cookingEvents: [
        {
          id: 'event-chili',
          recipeId: chili.id,
          recipeName: chili.name,
          scheduledDate: '2026-01-05',
          outputQuantity: { value: 6, unit: 'serving' },
          remaining: { value: 2, unit: 'serving' },
          desiredQuantity: { value: 2, unit: 'serving' },
          reusePolicy: 'batch-friendly',
          mealTypes: ['dinner'],
          recipe: chili,
        },
      ],
    })
    const proposal = run(input)
    expect(generationInvariantIssues(input, proposal)).toEqual([])
    expect(proposal.assignments.map((row) => row.slotId).sort()).toEqual([
      'slot-fri',
      'slot-thu',
      'slot-wed',
    ])
    const taken = proposal.assignments.flatMap((row) =>
      row.components.filter(
        (component) => component.type === 'leftover' && component.cookingEventId === 'event-chili',
      ),
    )
    const total = taken.reduce((sum, component) => sum + component.allocatedQuantity.value, 0)
    expect(total).toBeLessThanOrEqual(2)
    expect(taken.length).toBeGreaterThan(0)
    expect(proposal.proposedCookingEvents?.some((event) => event.id === 'event-chili')).toBe(false)
    expect(
      proposal.preparationSummary?.some(
        (line) => line.action === 'reheat' && line.name === 'Chili',
      ),
    ).toBe(true)
  })
})
