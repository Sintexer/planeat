import { describe, expect, it } from 'vitest'
import type { Recipe } from '../../recipes/Recipe'
import {
  buildGenerationDiagnostics,
  candidateConstraintReasons,
  DEFAULT_GENERATION_HARD_POLICY,
  missingGenerationPolicyRefs,
  mergeGenerationHardPolicy,
  restrictionReasonsForRecipe,
  type GenerationHardPolicy,
} from './constraints'

function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'soup',
    name: 'Soup',
    yield: { value: 4, unit: 'serving' },
    defaultPortionPerPerson: { value: 1, unit: 'serving' },
    ingredientLines: [{ displayText: 'water', ingredientId: 'water', quantity: null }],
    instructions: '',
    roles: ['complete'],
    mealTypes: ['dinner'],
    effort: 'regular',
    reusePolicy: 'batch-friendly',
    freezerFriendly: false,
    tagIds: ['comfort'],
    totalTimeMinutes: 20,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

function policy(overrides: Partial<GenerationHardPolicy> = {}): GenerationHardPolicy {
  return { ...DEFAULT_GENERATION_HARD_POLICY, ...overrides }
}

describe('restrictionReasonsForRecipe', () => {
  it('excludes a listed recipe id', () => {
    expect(restrictionReasonsForRecipe(recipe(), policy({ excludedRecipeIds: ['soup'] }))).toEqual([
      'excluded-recipe',
    ])
  })

  it('requires at least one listed tag (OR) and ANDs excluded tags', () => {
    const spicy = recipe({ tagIds: ['spicy'] })
    expect(
      restrictionReasonsForRecipe(spicy, policy({ requiredTagIds: ['comfort', 'quick'] })),
    ).toEqual(['required-tags'])
    expect(
      restrictionReasonsForRecipe(recipe(), policy({ requiredTagIds: ['comfort', 'quick'] })),
    ).toEqual([])
    expect(restrictionReasonsForRecipe(recipe(), policy({ excludedTagIds: ['comfort'] }))).toEqual([
      'excluded-tags',
    ])
  })

  it('include means at least one listed ingredient id is linked', () => {
    expect(
      restrictionReasonsForRecipe(recipe(), policy({ includeIngredientIds: ['peanut', 'water'] })),
    ).toEqual([])
    expect(
      restrictionReasonsForRecipe(recipe(), policy({ includeIngredientIds: ['peanut'] })),
    ).toEqual(['include-ingredients'])
  })

  it('drops recipes that link an excluded ingredient', () => {
    expect(
      restrictionReasonsForRecipe(recipe(), policy({ excludeIngredientIds: ['water'] })),
    ).toEqual(['exclude-ingredients'])
  })

  it('does not treat missing time as zero when a limit is set', () => {
    const untimed = recipe({ totalTimeMinutes: undefined })
    expect(restrictionReasonsForRecipe(untimed, policy({ maxTotalTimeMinutes: 30 }))).toEqual([
      'unknown-time',
    ])
    expect(
      restrictionReasonsForRecipe(
        untimed,
        policy({ maxTotalTimeMinutes: 30, unknownTimePolicy: 'allow' }),
      ),
    ).toEqual([])
    expect(
      restrictionReasonsForRecipe(
        recipe({ totalTimeMinutes: 45 }),
        policy({ maxTotalTimeMinutes: 30 }),
      ),
    ).toEqual(['max-total-time'])
    expect(restrictionReasonsForRecipe(untimed, policy())).toEqual([])
  })

  it('unlinked lines follow the unknown-ingredient policy when ingredient facets are on', () => {
    const unlinked = recipe({
      ingredientLines: [{ displayText: 'mystery oil', quantity: null }],
    })
    expect(
      restrictionReasonsForRecipe(unlinked, policy({ excludeIngredientIds: ['peanut'] })),
    ).toEqual(['unknown-ingredients'])
    expect(
      restrictionReasonsForRecipe(
        unlinked,
        policy({ excludeIngredientIds: ['peanut'], unknownIngredientPolicy: 'allow' }),
      ),
    ).toEqual([])
    expect(
      restrictionReasonsForRecipe(
        unlinked,
        policy({ includeIngredientIds: ['water'], unknownIngredientPolicy: 'allow' }),
      ),
    ).toEqual(['include-ingredients'])
  })

  it('does not drop a required-tag facet when the tag id is missing from the catalog', () => {
    const missing = missingGenerationPolicyRefs(policy({ requiredTagIds: ['gone'] }), {
      recipeIds: ['soup'],
      tagIds: ['comfort'],
      ingredientIds: ['water'],
    })
    expect(missing.tagIds).toEqual(['gone'])
    expect(restrictionReasonsForRecipe(recipe(), policy({ requiredTagIds: ['gone'] }))).toEqual([
      'required-tags',
    ])
  })
})

describe('candidateConstraintReasons', () => {
  it('still requires complete and the slot occasion', () => {
    expect(candidateConstraintReasons(recipe({ roles: ['main'] }), 'dinner', policy())).toEqual([
      'not-complete',
    ])
    expect(candidateConstraintReasons(recipe(), 'lunch', policy())).toEqual(['occasion'])
  })
})

describe('mergeGenerationHardPolicy', () => {
  it('defaults unknown policies to exclude and ignores invalid max time', () => {
    const merged = mergeGenerationHardPolicy({ maxTotalTimeMinutes: 0 })
    expect(merged.unknownTimePolicy).toBe('exclude')
    expect(merged.unknownIngredientPolicy).toBe('exclude')
    expect(merged.maxTotalTimeMinutes).toBeUndefined()
  })
})

describe('buildGenerationDiagnostics', () => {
  it('counts facet drops and lists fixed conflicts without rewriting them', () => {
    const peanutSoup = recipe({
      id: 'peanut-soup',
      ingredientLines: [{ displayText: 'peanut', ingredientId: 'peanut', quantity: null }],
    })
    const diagnostics = buildGenerationDiagnostics(
      [recipe(), peanutSoup],
      ['dinner'],
      policy({ excludeIngredientIds: ['peanut'] }),
      [
        {
          slotId: 'slot-mon',
          date: '2026-01-05',
          mealType: 'dinner',
          recipeId: 'peanut-soup',
          recipe: peanutSoup,
        },
      ],
      {
        recipeIds: ['soup', 'peanut-soup'],
        tagIds: ['comfort'],
        ingredientIds: ['water', 'peanut'],
      },
    )
    expect(diagnostics.dropCounts.some((row) => row.reason === 'exclude-ingredients')).toBe(true)
    expect(diagnostics.fixedConflicts).toEqual([
      {
        slotId: 'slot-mon',
        date: '2026-01-05',
        mealType: 'dinner',
        reasons: ['exclude-ingredients'],
      },
    ])
  })
})
