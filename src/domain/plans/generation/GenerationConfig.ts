import type { WeekStartDay } from '../../shared/LocalDate'
import { DEFAULT_SETTINGS, type Settings } from '../../shared/Settings'
import type { TagId } from '../../tags/Tag'
import {
  canonicalizeGenerationHardPolicy,
  mergeGenerationHardPolicy,
  type GenerationHardPolicy,
} from './constraints'
import {
  canonicalizeGenerationBatchPolicy,
  canonicalizeGenerationCompositionBounds,
  canonicalizeGenerationSearchBudget,
  GENERATION_POLICY_VERSION,
  mergeGenerationBatchPolicy,
  mergeGenerationCompositionBounds,
  mergeGenerationSearchBudget,
  type GenerationBatchPolicy,
  type GenerationCompositionBounds,
  type GenerationSearchBudget,
} from './proposal'
import { canonicalizeGenerationSoftPrefs, mergeGenerationSoftPrefs } from './scoring'

export type GenerationConfig = {
  generationHardPolicy: GenerationHardPolicy
  quickMealsOnlyDays: WeekStartDay[]
  avoidMultipleDemandingPreps: boolean
  favorVegetablesDaily: boolean
  preferredBatchPrepDays: WeekStartDay[]
  maxBatchPrepUnits: number
  generationPreferredTagIds: string[]
  generationSearchBudget: GenerationSearchBudget
  generationCompositionBounds: GenerationCompositionBounds
  generationBatchPolicy: GenerationBatchPolicy
}

const KNOWN_CONFIG_KEYS = new Set<string>([
  'generationHardPolicy',
  'quickMealsOnlyDays',
  'avoidMultipleDemandingPreps',
  'favorVegetablesDaily',
  'preferredBatchPrepDays',
  'maxBatchPrepUnits',
  'generationPreferredTagIds',
  'generationSearchBudget',
  'generationCompositionBounds',
  'generationBatchPolicy',
])

function extrasFromRow(row: object): Record<string, unknown> {
  const extras: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (!KNOWN_CONFIG_KEYS.has(key)) extras[key] = value
  }
  return extras
}

export function mergeGenerationConfig(
  row?: Partial<GenerationConfig> | Record<string, unknown> | null,
): GenerationConfig {
  const record = row && typeof row === 'object' ? row : {}
  const soft = mergeGenerationSoftPrefs({
    quickMealsOnlyDays: (record as Partial<GenerationConfig>).quickMealsOnlyDays,
    avoidMultipleDemandingPreps: (record as Partial<GenerationConfig>).avoidMultipleDemandingPreps,
    favorVegetablesDaily: (record as Partial<GenerationConfig>).favorVegetablesDaily,
    preferredBatchPrepDays: (record as Partial<GenerationConfig>).preferredBatchPrepDays,
    maxBatchPrepUnits: (record as Partial<GenerationConfig>).maxBatchPrepUnits,
    generationPreferredTagIds: (record as Partial<GenerationConfig>).generationPreferredTagIds,
  })
  const known: GenerationConfig = {
    generationHardPolicy: mergeGenerationHardPolicy(
      (record as Partial<GenerationConfig>).generationHardPolicy,
    ),
    quickMealsOnlyDays: [...soft.quickMealsOnlyDays],
    avoidMultipleDemandingPreps: soft.avoidMultipleDemandingPreps,
    favorVegetablesDaily: soft.favorVegetablesDaily,
    preferredBatchPrepDays: [...soft.preferredBatchPrepDays],
    maxBatchPrepUnits: soft.maxBatchPrepUnits,
    generationPreferredTagIds: [...soft.generationPreferredTagIds],
    generationSearchBudget: mergeGenerationSearchBudget(
      (record as Partial<GenerationConfig>).generationSearchBudget,
    ),
    generationCompositionBounds: mergeGenerationCompositionBounds(
      (record as Partial<GenerationConfig>).generationCompositionBounds,
    ),
    generationBatchPolicy: mergeGenerationBatchPolicy(
      (record as Partial<GenerationConfig>).generationBatchPolicy,
    ),
  }
  return { ...extrasFromRow(record), ...known }
}

export function canonicalizeGenerationConfig(config: GenerationConfig): GenerationConfig {
  const merged = mergeGenerationConfig(config)
  const soft = canonicalizeGenerationSoftPrefs({
    quickMealsOnlyDays: merged.quickMealsOnlyDays,
    avoidMultipleDemandingPreps: merged.avoidMultipleDemandingPreps,
    favorVegetablesDaily: merged.favorVegetablesDaily,
    preferredBatchPrepDays: merged.preferredBatchPrepDays,
    maxBatchPrepUnits: merged.maxBatchPrepUnits,
    generationPreferredTagIds: merged.generationPreferredTagIds,
  })
  return {
    ...merged,
    generationHardPolicy: canonicalizeGenerationHardPolicy(merged.generationHardPolicy),
    quickMealsOnlyDays: [...soft.quickMealsOnlyDays],
    preferredBatchPrepDays: [...soft.preferredBatchPrepDays],
    generationPreferredTagIds: [...soft.generationPreferredTagIds],
    generationSearchBudget: canonicalizeGenerationSearchBudget(merged.generationSearchBudget),
    generationCompositionBounds: canonicalizeGenerationCompositionBounds(
      merged.generationCompositionBounds,
    ),
    generationBatchPolicy: canonicalizeGenerationBatchPolicy(merged.generationBatchPolicy),
  }
}

export function generationConfigEquals(a: GenerationConfig, b: GenerationConfig): boolean {
  return (
    JSON.stringify(canonicalizeGenerationConfig(a)) ===
    JSON.stringify(canonicalizeGenerationConfig(b))
  )
}

export function configFromSettings(settings: Settings): GenerationConfig {
  return mergeGenerationConfig({
    generationHardPolicy: settings.generationHardPolicy,
    quickMealsOnlyDays: settings.quickMealsOnlyDays,
    avoidMultipleDemandingPreps: settings.avoidMultipleDemandingPreps,
    favorVegetablesDaily: settings.favorVegetablesDaily,
    preferredBatchPrepDays: settings.preferredBatchPrepDays,
    maxBatchPrepUnits: settings.maxBatchPrepUnits,
    generationPreferredTagIds: settings.generationPreferredTagIds,
    generationSearchBudget: settings.generationSearchBudget,
    generationCompositionBounds: settings.generationCompositionBounds,
    generationBatchPolicy: settings.generationBatchPolicy,
  })
}

export function applyConfigToSettings(settings: Settings, config: GenerationConfig): Settings {
  const merged = mergeGenerationConfig(config)
  return {
    ...settings,
    generationHardPolicy: merged.generationHardPolicy,
    quickMealsOnlyDays: merged.quickMealsOnlyDays,
    avoidMultipleDemandingPreps: merged.avoidMultipleDemandingPreps,
    favorVegetablesDaily: merged.favorVegetablesDaily,
    preferredBatchPrepDays: merged.preferredBatchPrepDays,
    maxBatchPrepUnits: merged.maxBatchPrepUnits,
    generationPreferredTagIds: merged.generationPreferredTagIds,
    generationSearchBudget: merged.generationSearchBudget,
    generationCompositionBounds: merged.generationCompositionBounds,
    generationBatchPolicy: merged.generationBatchPolicy,
  }
}

export function effectiveGenerationConfig(args: {
  settings: Settings
  preset?: GenerationConfig | null
  draft?: Partial<GenerationConfig> | Record<string, unknown> | null
}): GenerationConfig {
  const base = args.preset ? mergeGenerationConfig(args.preset) : configFromSettings(args.settings)
  if (!args.draft) return base
  const draft = args.draft as Partial<GenerationConfig>
  return mergeGenerationConfig({
    ...base,
    ...draft,
    generationHardPolicy: {
      ...base.generationHardPolicy,
      ...draft.generationHardPolicy,
    },
    generationSearchBudget: {
      ...base.generationSearchBudget,
      ...draft.generationSearchBudget,
    },
    generationCompositionBounds: {
      ...base.generationCompositionBounds,
      ...draft.generationCompositionBounds,
    },
    generationBatchPolicy: {
      ...base.generationBatchPolicy,
      ...draft.generationBatchPolicy,
    },
  })
}

export const BUILTIN_GENERATION_PRESET_IDS = [
  'preset:balanced',
  'preset:less-cooking',
  'preset:more-variety',
  'preset:batch-cooking',
] as const

export type BuiltinGenerationPresetId = (typeof BUILTIN_GENERATION_PRESET_IDS)[number]

export function isBuiltinGenerationPresetId(id: string): id is BuiltinGenerationPresetId {
  return (BUILTIN_GENERATION_PRESET_IDS as readonly string[]).includes(id)
}

function fromDefaultSettings(overrides: Partial<GenerationConfig> = {}): GenerationConfig {
  return mergeGenerationConfig({ ...configFromSettings(DEFAULT_SETTINGS), ...overrides })
}

export type BuiltinGenerationPreset = {
  id: BuiltinGenerationPresetId
  config: GenerationConfig
}

export const BUILTIN_GENERATION_PRESETS: readonly BuiltinGenerationPreset[] = [
  {
    id: 'preset:balanced',
    config: fromDefaultSettings({
      generationBatchPolicy: { maxExtraPlannedUses: 0, unallocatedProduction: 'disallow' },
    }),
  },
  {
    id: 'preset:less-cooking',
    config: fromDefaultSettings({
      avoidMultipleDemandingPreps: true,
      generationBatchPolicy: {
        maxExtraPlannedUses: 1,
        unallocatedProduction: 'allow-with-warning',
      },
    }),
  },
  {
    id: 'preset:more-variety',
    config: fromDefaultSettings({
      generationPreferredTagIds: [],
      generationBatchPolicy: { maxExtraPlannedUses: 0, unallocatedProduction: 'disallow' },
    }),
  },
  {
    id: 'preset:batch-cooking',
    config: fromDefaultSettings({
      generationBatchPolicy: { maxExtraPlannedUses: 1, unallocatedProduction: 'disallow' },
    }),
  },
]

export function builtinGenerationPresetById(id: string): BuiltinGenerationPreset | undefined {
  return BUILTIN_GENERATION_PRESETS.find((preset) => preset.id === id)
}

export function serializedGenerationPolicyVersion(): string {
  return GENERATION_POLICY_VERSION
}

export type StaleGenerationConfigRef = {
  field:
    | 'excludedRecipeIds'
    | 'requiredTagIds'
    | 'excludedTagIds'
    | 'generationPreferredTagIds'
    | 'includeIngredientIds'
    | 'excludeIngredientIds'
  id: string
  status: 'archived-tag' | 'missing-tag' | 'missing-recipe' | 'missing-ingredient'
}

export function findStaleGenerationConfigRefs(
  config: GenerationConfig,
  catalogs: {
    tagsById: ReadonlyMap<TagId, { archived?: boolean }>
    knownRecipeIds: ReadonlySet<string>
    knownIngredientIds: ReadonlySet<string>
  },
): StaleGenerationConfigRef[] {
  const merged = mergeGenerationConfig(config)
  const stale: StaleGenerationConfigRef[] = []
  for (const id of merged.generationHardPolicy.excludedRecipeIds) {
    if (!catalogs.knownRecipeIds.has(id)) {
      stale.push({ field: 'excludedRecipeIds', id, status: 'missing-recipe' })
    }
  }
  const tagFields: {
    field: 'requiredTagIds' | 'excludedTagIds' | 'generationPreferredTagIds'
    ids: readonly string[]
  }[] = [
    { field: 'requiredTagIds', ids: merged.generationHardPolicy.requiredTagIds },
    { field: 'excludedTagIds', ids: merged.generationHardPolicy.excludedTagIds },
    { field: 'generationPreferredTagIds', ids: merged.generationPreferredTagIds },
  ]
  for (const { field, ids } of tagFields) {
    for (const id of ids) {
      const tag = catalogs.tagsById.get(id)
      if (!tag) {
        stale.push({ field, id, status: 'missing-tag' })
      } else if (tag.archived === true) {
        stale.push({ field, id, status: 'archived-tag' })
      }
    }
  }
  for (const id of merged.generationHardPolicy.includeIngredientIds) {
    if (!catalogs.knownIngredientIds.has(id)) {
      stale.push({ field: 'includeIngredientIds', id, status: 'missing-ingredient' })
    }
  }
  for (const id of merged.generationHardPolicy.excludeIngredientIds) {
    if (!catalogs.knownIngredientIds.has(id)) {
      stale.push({ field: 'excludeIngredientIds', id, status: 'missing-ingredient' })
    }
  }
  return stale
}
