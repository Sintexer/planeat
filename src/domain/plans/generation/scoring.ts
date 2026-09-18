import type { Recipe } from '../../recipes/Recipe'
import type { MealType } from '../../shared/MealEnums'
import type { LocalDate, WeekStartDay } from '../../shared/LocalDate'
import { weekdayOf } from '../../shared/LocalDate'
import { effortUnits } from '../prepEffort'
import { compareCandidateRecipes } from './candidates'

export type ScoreReasonCode =
  | 'quick-day'
  | 'effort'
  | 'repetition'
  | 'planned-history'
  | 'workload'
  | 'vegetable'
  | 'preferred-tags'
  | 'preferred-prep-day'

export type ScoreReason = {
  code: ScoreReasonCode
  source?: 'this-week' | 'planned-history'
}

export type GenerationSoftPrefs = {
  quickMealsOnlyDays: readonly WeekStartDay[]
  avoidMultipleDemandingPreps: boolean
  favorVegetablesDaily: boolean
  preferredBatchPrepDays: readonly WeekStartDay[]
  maxBatchPrepUnits: number
  generationPreferredTagIds: readonly string[]
}

export const DEFAULT_GENERATION_SOFT_PREFS: GenerationSoftPrefs = {
  quickMealsOnlyDays: [],
  avoidMultipleDemandingPreps: true,
  favorVegetablesDaily: false,
  preferredBatchPrepDays: [],
  maxBatchPrepUnits: 2,
  generationPreferredTagIds: [],
}

export type ScoringContext = {
  date: LocalDate
  mealType: MealType
  prefs: GenerationSoftPrefs
  weekRecipeIds: readonly string[]
  previousWeekRecipeIds: readonly string[]
  demandingCooksOnDate: number
  cookingEventCountOnDate: number
  tagNamesById: Readonly<Record<string, string>>
}

const SCORE_REASONS: { index: number; code: ScoreReasonCode; source?: ScoreReason['source'] }[] = [
  { index: 0, code: 'quick-day' },
  { index: 1, code: 'effort' },
  { index: 2, code: 'workload' },
  { index: 3, code: 'repetition', source: 'this-week' },
  { index: 4, code: 'planned-history', source: 'planned-history' },
  { index: 5, code: 'effort' },
  { index: 6, code: 'vegetable' },
  { index: 7, code: 'preferred-tags' },
  { index: 8, code: 'preferred-prep-day' },
]

function asWeekdays(value: unknown): WeekStartDay[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is WeekStartDay => typeof item === 'number' && item >= 0 && item <= 6,
  )
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

export function mergeGenerationSoftPrefs(
  row?: Partial<GenerationSoftPrefs> | null,
): GenerationSoftPrefs {
  return {
    quickMealsOnlyDays: asWeekdays(row?.quickMealsOnlyDays),
    avoidMultipleDemandingPreps:
      typeof row?.avoidMultipleDemandingPreps === 'boolean'
        ? row.avoidMultipleDemandingPreps
        : DEFAULT_GENERATION_SOFT_PREFS.avoidMultipleDemandingPreps,
    favorVegetablesDaily:
      typeof row?.favorVegetablesDaily === 'boolean'
        ? row.favorVegetablesDaily
        : DEFAULT_GENERATION_SOFT_PREFS.favorVegetablesDaily,
    preferredBatchPrepDays: asWeekdays(row?.preferredBatchPrepDays),
    maxBatchPrepUnits:
      typeof row?.maxBatchPrepUnits === 'number' && Number.isFinite(row.maxBatchPrepUnits)
        ? row.maxBatchPrepUnits
        : DEFAULT_GENERATION_SOFT_PREFS.maxBatchPrepUnits,
    generationPreferredTagIds: asStringArray(row?.generationPreferredTagIds),
  }
}

export function canonicalizeGenerationSoftPrefs(prefs: GenerationSoftPrefs): GenerationSoftPrefs {
  const merged = mergeGenerationSoftPrefs(prefs)
  return {
    ...merged,
    quickMealsOnlyDays: [...merged.quickMealsOnlyDays].sort((a, b) => a - b),
    preferredBatchPrepDays: [...merged.preferredBatchPrepDays].sort((a, b) => a - b),
    generationPreferredTagIds: [...merged.generationPreferredTagIds].sort((a, b) =>
      a < b ? -1 : a > b ? 1 : 0,
    ),
  }
}

export function recipeProvidesVegetable(
  recipe: Recipe,
  tagNamesById: Readonly<Record<string, string>>,
): boolean {
  if (recipe.roles.includes('vegetable')) return true
  return recipe.tagIds.some((id) => tagNamesById[id]?.toLowerCase() === 'vegetable')
}

function effortRank(recipe: Recipe): number {
  if (recipe.effort === 'quick') return 0
  if (recipe.effort === 'demanding') return 2
  return 1
}

export function candidateScoreTuple(recipe: Recipe, ctx: ScoringContext): number[] {
  const weekday = weekdayOf(ctx.date)
  const isQuickDay = ctx.prefs.quickMealsOnlyDays.includes(weekday)
  const weekUses = ctx.weekRecipeIds.filter((id) => id === recipe.id).length
  const historyUses = ctx.previousWeekRecipeIds.filter((id) => id === recipe.id).length
  const demandingStack =
    ctx.prefs.avoidMultipleDemandingPreps &&
    recipe.effort === 'demanding' &&
    ctx.demandingCooksOnDate >= 1
      ? 1
      : 0
  const nextUnits = effortUnits(ctx.cookingEventCountOnDate + 1)
  const workload = nextUnits > ctx.prefs.maxBatchPrepUnits ? 1 : 0
  let repetition = weekUses
  if (recipe.maxPreferredRepeats !== undefined && weekUses + 1 > recipe.maxPreferredRepeats) {
    repetition += 1
  }
  const vegMiss =
    ctx.prefs.favorVegetablesDaily && !recipeProvidesVegetable(recipe, ctx.tagNamesById) ? 1 : 0
  const preferred = ctx.prefs.generationPreferredTagIds
  const tagMiss =
    preferred.length > 0 && !preferred.some((id) => recipe.tagIds.includes(id)) ? 1 : 0
  const offPrep =
    ctx.prefs.preferredBatchPrepDays.length > 0 &&
    !ctx.prefs.preferredBatchPrepDays.includes(weekday)
      ? 1
      : 0

  return [
    isQuickDay && recipe.effort !== 'quick' ? 1 : 0,
    demandingStack,
    workload,
    repetition,
    historyUses,
    effortRank(recipe),
    vegMiss,
    tagMiss,
    offPrep,
    recipe.totalTimeMinutes === undefined ? 1 : 0,
  ]
}

export function compareScoreTuples(left: readonly number[], right: readonly number[]): number {
  const n = Math.min(left.length, right.length)
  for (let i = 0; i < n; i++) {
    if (left[i] !== right[i]) return left[i] - right[i]
  }
  return left.length - right.length
}

export function compareScoredCandidates(a: Recipe, b: Recipe, ctx: ScoringContext): number {
  const tuple = compareScoreTuples(candidateScoreTuple(a, ctx), candidateScoreTuple(b, ctx))
  if (tuple !== 0) return tuple
  return compareCandidateRecipes(a, b)
}

export type WeekObjective = {
  coverage: number
  penalties: number[]
}

export function emptyWeekObjective(): WeekObjective {
  return { coverage: 0, penalties: [] }
}

export function addAssignmentToObjective(
  objective: WeekObjective,
  tuple: readonly number[],
): WeekObjective {
  const penalties =
    objective.penalties.length === 0
      ? [...tuple]
      : objective.penalties.map((value, index) => value + (tuple[index] ?? 0))
  return { coverage: objective.coverage + 1, penalties }
}

/** Lower is better after coverage (higher coverage wins). */
export function compareWeekObjectives(a: WeekObjective, b: WeekObjective): number {
  if (a.coverage !== b.coverage) return b.coverage - a.coverage
  return compareScoreTuples(a.penalties, b.penalties)
}

export function scoreReasonsForPick(
  winner: Recipe,
  eligible: readonly Recipe[],
  ctx: ScoringContext,
): ScoreReason[] {
  const weekday = weekdayOf(ctx.date)
  const winnerTuple = candidateScoreTuple(winner, ctx)
  const reasons: ScoreReason[] = []
  const seen = new Set<string>()

  const push = (reason: ScoreReason) => {
    const key = `${reason.code}:${reason.source ?? ''}`
    if (seen.has(key)) return
    seen.add(key)
    reasons.push(reason)
  }

  if (ctx.prefs.quickMealsOnlyDays.includes(weekday) && winner.effort === 'quick') {
    push({ code: 'quick-day' })
  }

  for (const other of eligible) {
    if (other.id === winner.id) continue
    const otherTuple = candidateScoreTuple(other, ctx)
    for (const { index, code, source } of SCORE_REASONS) {
      if (winnerTuple[index] < otherTuple[index]) push({ code, source })
    }
  }

  if (
    ctx.previousWeekRecipeIds.includes(winner.id) ||
    eligible.some(
      (recipe) => recipe.id !== winner.id && ctx.previousWeekRecipeIds.includes(recipe.id),
    )
  ) {
    if (eligible.some((recipe) => recipe.id !== winner.id)) {
      const historyIndex = 4
      const historyInfluenced = eligible.some((recipe) => {
        if (recipe.id === winner.id) return false
        return candidateScoreTuple(recipe, ctx)[historyIndex] > winnerTuple[historyIndex]
      })
      if (historyInfluenced) push({ code: 'planned-history', source: 'planned-history' })
    }
  }

  return reasons
}

export function selectBestCandidate(
  eligible: readonly Recipe[],
  ctx: ScoringContext,
): { recipe: Recipe; scoreReasons: ScoreReason[] } | undefined {
  if (eligible.length === 0) return undefined
  const ranked = [...eligible].sort((a, b) => compareScoredCandidates(a, b, ctx))
  const recipe = ranked[0]
  return { recipe, scoreReasons: scoreReasonsForPick(recipe, eligible, ctx) }
}
