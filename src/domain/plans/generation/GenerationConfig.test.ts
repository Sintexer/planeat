import { describe, expect, it } from 'vitest'
import { scaleQuantity } from '../../shared/scaleQuantity'
import { DEFAULT_SETTINGS } from '../../shared/Settings'
import type { Recipe } from '../../recipes/Recipe'
import type { MealSlot } from '../MealSlot'
import { mergeGenerationHardPolicy } from './constraints'
import {
  applyConfigToSettings,
  BUILTIN_GENERATION_PRESETS,
  builtinGenerationPresetById,
  configFromSettings,
  effectiveGenerationConfig,
  findStaleGenerationConfigRefs,
  generationConfigEquals,
  mergeGenerationConfig,
  serializedGenerationPolicyVersion,
} from './GenerationConfig'
import { GENERATION_POLICY_VERSION, type GenerationInput } from './proposal'
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

function inputFromConfig(config: ReturnType<typeof mergeGenerationConfig>): GenerationInput {
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
    policy: config.generationHardPolicy,
    fixedMeals: [],
    catalogs: { recipeIds: ['chili'], tagIds: [], ingredientIds: [] },
    softPrefs: {
      quickMealsOnlyDays: config.quickMealsOnlyDays,
      avoidMultipleDemandingPreps: config.avoidMultipleDemandingPreps,
      favorVegetablesDaily: config.favorVegetablesDaily,
      preferredBatchPrepDays: config.preferredBatchPrepDays,
      maxBatchPrepUnits: config.maxBatchPrepUnits,
      generationPreferredTagIds: config.generationPreferredTagIds,
    },
    previousWeekRecipeIds: [],
    tagNamesById: {},
    searchBudget: config.generationSearchBudget,
    compositionBounds: config.generationCompositionBounds,
    batchPolicy: config.generationBatchPolicy,
  }
}

function cookCount(proposal: ReturnType<typeof runGenerationSearch>): number {
  return proposal.assignments.filter((row) =>
    row.components.some((component) => component.type === 'recipe'),
  ).length
}

describe('GenerationConfig', () => {
  it('keeps GENERATION_POLICY_VERSION 31 on serialized configs', () => {
    expect(serializedGenerationPolicyVersion()).toBe('31')
    expect(GENERATION_POLICY_VERSION).toBe('31')
  })

  it('round-trips household settings and reports dirty drafts', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      generationPreferredTagIds: ['veg'],
      generationHardPolicy: {
        ...DEFAULT_SETTINGS.generationHardPolicy,
        excludedRecipeIds: ['soup'],
      },
    }
    const config = configFromSettings(settings)
    expect(
      generationConfigEquals(config, configFromSettings(applyConfigToSettings(settings, config))),
    ).toBe(true)
    const dirty = mergeGenerationConfig({
      ...config,
      generationHardPolicy: { ...config.generationHardPolicy, maxTotalTimeMinutes: 30 },
    })
    expect(generationConfigEquals(config, dirty)).toBe(false)
  })

  it('merges a preset snapshot then request edits over Settings', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      generationPreferredTagIds: ['household-pref'],
    }
    const moreVariety = builtinGenerationPresetById('preset:more-variety')!.config
    const merged = effectiveGenerationConfig({
      settings,
      preset: moreVariety,
      draft: {
        generationHardPolicy: { excludedRecipeIds: ['skip-this-week'] },
      },
    })
    expect(merged.generationPreferredTagIds).toEqual([])
    expect(merged.generationHardPolicy.excludedRecipeIds).toEqual(['skip-this-week'])
  })

  it('keeps unknown future keys when merging a stored config', () => {
    const merged = mergeGenerationConfig({
      ...configFromSettings(DEFAULT_SETTINGS),
      futureWeight: 12,
    } as Record<string, unknown>)
    expect((merged as Record<string, unknown>).futureWeight).toBe(12)
  })

  it('built-in configs are valid after policy merges', () => {
    for (const preset of BUILTIN_GENERATION_PRESETS) {
      const merged = mergeGenerationConfig(preset.config)
      expect(merged.generationHardPolicy).toEqual(
        mergeGenerationHardPolicy(merged.generationHardPolicy),
      )
      expect(merged.generationBatchPolicy.maxExtraPlannedUses).toBeGreaterThanOrEqual(0)
      expect(merged.avoidMultipleDemandingPreps).toBe(true)
    }
    expect(builtinGenerationPresetById('preset:balanced')?.config.generationBatchPolicy).toEqual({
      maxExtraPlannedUses: 0,
      unallocatedProduction: 'disallow',
    })
    expect(
      builtinGenerationPresetById('preset:less-cooking')?.config.generationBatchPolicy,
    ).toEqual({
      maxExtraPlannedUses: 1,
      unallocatedProduction: 'allow-with-warning',
    })
    expect(
      builtinGenerationPresetById('preset:more-variety')?.config.generationPreferredTagIds,
    ).toEqual([])
    expect(
      builtinGenerationPresetById('preset:batch-cooking')?.config.generationBatchPolicy,
    ).toEqual({
      maxExtraPlannedUses: 1,
      unallocatedProduction: 'disallow',
    })
  })

  it('re-selecting a built-in restores the code snapshot', () => {
    const balanced = builtinGenerationPresetById('preset:balanced')!.config
    const dirty = mergeGenerationConfig({
      ...balanced,
      generationHardPolicy: { ...balanced.generationHardPolicy, maxTotalTimeMinutes: 20 },
    })
    expect(generationConfigEquals(dirty, balanced)).toBe(false)
    const restored = mergeGenerationConfig(builtinGenerationPresetById('preset:balanced')!.config)
    expect(generationConfigEquals(restored, balanced)).toBe(true)
  })

  it('reports missing refs and keeps the ids on the config', () => {
    const config = mergeGenerationConfig({
      ...configFromSettings(DEFAULT_SETTINGS),
      generationPreferredTagIds: ['gone-tag', 'archived'],
      generationHardPolicy: {
        ...DEFAULT_SETTINGS.generationHardPolicy,
        excludedRecipeIds: ['gone-recipe'],
        includeIngredientIds: ['gone-ing'],
      },
    })
    const stale = findStaleGenerationConfigRefs(config, {
      tagsById: new Map([['archived', { archived: true }]]),
      knownRecipeIds: new Set(),
      knownIngredientIds: new Set(),
    })
    expect(stale.map((row) => row.id).sort()).toEqual([
      'archived',
      'gone-ing',
      'gone-recipe',
      'gone-tag',
    ])
    expect(config.generationHardPolicy.excludedRecipeIds).toEqual(['gone-recipe'])
    expect(config.generationPreferredTagIds).toContain('gone-tag')
  })

  it('Batch cooking produces fewer cooking events than Balanced on a two-dinner fixture', () => {
    const balanced = runGenerationSearch(
      inputFromConfig(builtinGenerationPresetById('preset:balanced')!.config),
      'req-1',
      scaleQuantity,
    )
    const batch = runGenerationSearch(
      inputFromConfig(builtinGenerationPresetById('preset:batch-cooking')!.config),
      'req-1',
      scaleQuantity,
    )
    expect(cookCount(batch)).toBeLessThan(cookCount(balanced))
    expect(cookCount(balanced)).toBe(2)
    expect(cookCount(batch)).toBe(1)
  })
})
