import { describe, expect, it } from 'vitest'
import type { Recipe } from '../../recipes/Recipe'
import type { MealSlot } from '../MealSlot'
import { DEFAULT_GENERATION_HARD_POLICY } from './constraints'
import { fingerprintFromInput, type GenerationInput, type WeekGenerationProposal } from './proposal'
import { DEFAULT_GENERATION_SOFT_PREFS } from './scoring'
import { validateProposalAgainstLive, validateSlotForGeneration } from './proposalValidation'

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

function live(overrides: Partial<GenerationInput> = {}): GenerationInput {
  return {
    planId: 'plan-1',
    planRevision: 1,
    peopleCount: 2,
    recipes: [recipe()],
    requestedSlots: [{ slot: slot(), componentCount: 0 }],
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

function proposal(
  snapshot: GenerationInput,
  overrides: Partial<WeekGenerationProposal> = {},
): WeekGenerationProposal {
  const selected = snapshot.recipes[0]
  const target = snapshot.requestedSlots[0]
  return {
    requestId: 'req-1',
    algorithmVersion: '34',
    policyVersion: '31',
    seed: snapshot.seed,
    fingerprint: fingerprintFromInput(snapshot),
    planId: snapshot.planId,
    assignments: [
      {
        slotId: target.slot.id,
        mealType: target.slot.mealType,
        source: { type: 'standalone' },
        components: [
          {
            type: 'recipe',
            recipeId: selected.id,
            recipeName: selected.name,
            outputQuantity: { value: 2, unit: 'serving' },
            allocatedQuantity: { value: 2, unit: 'serving' },
          },
        ],
        scoreReasons: [],
      },
    ],
    unfilled: [],
    diagnostics: {
      dropCounts: [],
      fixedConflicts: [],
      missingPolicyRefs: { recipeIds: [], tagIds: [], ingredientIds: [] },
    },
    budgetUsed: {
      beamWidth: 8,
      expansionBudget: 400,
      perSlotCandidateLimit: 8,
    },
    expansionsUsed: 0,
    ...overrides,
  }
}

describe('validateSlotForGeneration', () => {
  it('rejects excluded, filled, and locked slots', () => {
    expect(validateSlotForGeneration(slot({ excluded: true }), 0)).toBe('slot-excluded')
    expect(validateSlotForGeneration(slot(), 1)).toBe('slot-not-empty')
    expect(validateSlotForGeneration(slot({ generationLocked: true }), 0)).toBe('slot-locked')
    expect(validateSlotForGeneration(slot(), 0)).toBeUndefined()
    expect(validateSlotForGeneration(slot(), 1, 'replace')).toBeUndefined()
    expect(validateSlotForGeneration(slot({ generationLocked: true }), 1, 'replace')).toBe(
      'slot-locked',
    )
  })
})

describe('validateProposalAgainstLive', () => {
  it('accepts a filled slot in replace mode', () => {
    const snapshot = live({
      generationMode: 'replace',
      requestedSlots: [{ slot: slot(), componentCount: 1, existingLabels: ['Soup'] }],
    })
    expect(validateProposalAgainstLive(proposal(snapshot), snapshot)).toBeUndefined()
  })

  it('accepts a matching empty-slot proposal', () => {
    const snapshot = live()
    expect(validateProposalAgainstLive(proposal(snapshot), snapshot)).toBeUndefined()
  })

  it('rejects a stale fingerprint after household size changes', () => {
    const original = live({ peopleCount: 2 })
    const next = live({ peopleCount: 4 })
    expect(validateProposalAgainstLive(proposal(original), next)).toBe('stale-proposal')
  })

  it('rejects a recipe that is no longer complete', () => {
    const original = live()
    const next = live({ recipes: [recipe({ roles: ['main'] })] })
    expect(validateProposalAgainstLive(proposal(original), next)).toBe('stale-proposal')
  })

  it('does not require unfilled requested slots to stay empty', () => {
    const lunch = slot({ id: 'slot-lunch', mealType: 'lunch' })
    const snapshot = live({
      requestedSlots: [
        { slot: slot(), componentCount: 0 },
        { slot: lunch, componentCount: 1 },
      ],
    })
    const generated = proposal(live(), {
      fingerprint: fingerprintFromInput(snapshot),
      unfilled: [{ slotId: 'slot-lunch', reason: 'no-eligible-candidates', mealType: 'lunch' }],
    })
    expect(validateProposalAgainstLive(generated, snapshot)).toBeUndefined()
  })

  it('rejects a recipe that no longer satisfies hard policy', () => {
    const original = live()
    const next = live({
      policy: { ...DEFAULT_GENERATION_HARD_POLICY, excludedRecipeIds: ['soup'] },
    })
    expect(validateProposalAgainstLive(proposal(original), next)).toBe('stale-proposal')
  })

  it('rejects a fingerprint after composition bounds change', () => {
    const original = live({
      compositionBounds: { maxPairingsPerRecipe: 2, maxComponentsPerCandidate: 4 },
    })
    const next = live({
      compositionBounds: { maxPairingsPerRecipe: 1, maxComponentsPerCandidate: 4 },
    })
    expect(validateProposalAgainstLive(proposal(original), next)).toBe('stale-proposal')
  })

  it('rejects a fingerprint after the search budget changes', () => {
    const original = live({
      searchBudget: { beamWidth: 8, expansionBudget: 400, perSlotCandidateLimit: 8 },
    })
    const next = live({
      searchBudget: { beamWidth: 2, expansionBudget: 10, perSlotCandidateLimit: 2 },
    })
    expect(validateProposalAgainstLive(proposal(original), next)).toBe('stale-proposal')
  })
})
