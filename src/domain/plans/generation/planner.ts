import type { Quantity } from '../../shared/Quantity'
import { weekdayOf } from '../../shared/LocalDate'
import { isReuseAllowed } from '../CookingEventAllocation'
import { effortUnits } from '../prepEffort'
import { analyzeCatalog, type CapabilityInventory } from './capabilities'
import { breakfastPatterns, patternToCandidate, rotateBreakfastPattern } from './breakfast'
import {
  assignmentFromCandidate,
  enumerateCompositionCandidates,
  foodsInComposition,
  leftoverRecipesInComposition,
  recipesInComposition,
  knownCompanions,
  type CompositionCandidate,
} from './compositions'
import { cookingBlockPreview, type CookingBlock } from './cookingBlock'
import { buildGenerationDiagnostics, DEFAULT_GENERATION_HARD_POLICY } from './constraints'
import {
  fingerprintFromInput,
  GENERATION_ALGORITHM_VERSION,
  GENERATION_POLICY_VERSION,
  mergeGenerationBatchPolicy,
  mergeGenerationMode,
  mergeGenerationSearchBudget,
  type CapacityNote,
  type GenerationBatchPolicy,
  type GenerationInput,
  type GenerationLeftoverEvent,
  type ProposedCookingEvent,
  type RequestedGenerationSlot,
  type SlotAssignment,
  type UnfilledSlot,
  type WeekGenerationProposal,
} from './proposal'
import {
  isValidPositiveQuantity,
  validateProposalAgainstLive,
  validateSlotForGeneration,
} from './proposalValidation'
import {
  cloneRecency,
  emptyRecency,
  rememberUse,
  recencyPenalty,
  type RecencyState,
} from './recency'
import {
  addAssignmentToObjective,
  compositionScoreTuple,
  compareScoreTuples,
  compareWeekObjectives,
  DEFAULT_GENERATION_SOFT_PREFS,
  emptyWeekObjective,
  GENERATION_PREF_TUPLE_LENGTH,
  scoreReasonsForComposition,
  type ScoreableComposition,
  type ScoringContext,
  type WeekObjective,
} from './scoring'
import { buildWeekStructure, resolveDayLoad } from './structure'

export type ScaleQuantity = (quantity: Quantity | null, factor: number) => Quantity | null

const MEAL_ORDER = { breakfast: 0, lunch: 1, dinner: 2 } as const

type Draft = {
  assignments: SlotAssignment[]
  unfilled: UnfilledSlot[]
  weekRecipeIds: string[]
  weekFoodIds: string[]
  demandingByDate: Map<string, number>
  cooksByDate: Map<string, number>
  remainingByEventId: Map<string, Quantity>
  leftoverEvents: Map<string, GenerationLeftoverEvent>
  proposedEventIds: Set<string>
  objective: WeekObjective
  recency: RecencyState
  blocks: CookingBlock[]
  open: Set<string>
}

function sortRequestedSlots(slots: readonly RequestedGenerationSlot[]): RequestedGenerationSlot[] {
  return [...slots].sort((a, b) => {
    if (a.slot.date !== b.slot.date) return a.slot.date < b.slot.date ? -1 : 1
    const meal = MEAL_ORDER[a.slot.mealType] - MEAL_ORDER[b.slot.mealType]
    if (meal !== 0) return meal
    return a.slot.id < b.slot.id ? -1 : a.slot.id > b.slot.id ? 1 : 0
  })
}

function hashSeed(seed: string): number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  hash ^= hash >>> 13
  hash = Math.imul(hash, 0x5bd1e995)
  hash ^= hash >>> 15
  return hash >>> 0
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seededShuffle<T>(items: readonly T[], random: () => number): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const swap = arr[i]
    arr[i] = arr[j]
    arr[j] = swap
  }
  return arr
}

function scoringContext(
  input: GenerationInput,
  row: RequestedGenerationSlot,
  draft: Draft,
): ScoringContext {
  const base = input.softPrefs ?? DEFAULT_GENERATION_SOFT_PREFS
  const prefs = { ...base, quickMealsOnlyDays: [...base.quickMealsOnlyDays] }
  if (resolveDayLoad(row.slot.date, input) === 'busy') {
    const day = weekdayOf(row.slot.date)
    if (!prefs.quickMealsOnlyDays.includes(day)) prefs.quickMealsOnlyDays.push(day)
  }
  return {
    date: row.slot.date,
    mealType: row.slot.mealType,
    prefs,
    weekRecipeIds: draft.weekRecipeIds,
    weekFoodIds: draft.weekFoodIds,
    previousWeekRecipeIds: input.previousWeekRecipeIds ?? [],
    demandingCooksOnDate: draft.demandingByDate.get(row.slot.date) ?? 0,
    cookingEventCountOnDate: draft.cooksByDate.get(row.slot.date) ?? 0,
    tagNamesById: input.tagNamesById ?? {},
    recency: draft.recency,
  }
}

function scoreable(candidate: CompositionCandidate): ScoreableComposition {
  return {
    id: candidate.id,
    recipes: recipesInComposition(candidate),
    foods: foodsInComposition(candidate),
    leftoverRecipes: leftoverRecipesInComposition(candidate),
    extraUses: candidate.extraUses,
  }
}

function cookingInputForDraft(input: GenerationInput, draft: Draft): GenerationInput {
  return {
    ...input,
    cookingEvents: [...draft.leftoverEvents.values()].map((event) => ({
      ...event,
      remaining: draft.remainingByEventId.get(event.id) ?? event.remaining,
    })),
  }
}

function leftoverFitsRemaining(
  candidate: CompositionCandidate,
  remainingByEventId: ReadonlyMap<string, Quantity>,
): boolean {
  for (const part of candidate.parts) {
    if (part.type !== 'leftover') continue
    const remaining = remainingByEventId.get(part.eventId)
    if (!remaining || remaining.value <= 0) return false
  }
  return true
}

function cloneDraft(draft: Draft): Draft {
  return {
    assignments: [...draft.assignments],
    unfilled: [...draft.unfilled],
    weekRecipeIds: [...draft.weekRecipeIds],
    weekFoodIds: [...draft.weekFoodIds],
    demandingByDate: new Map(draft.demandingByDate),
    cooksByDate: new Map(draft.cooksByDate),
    remainingByEventId: new Map(draft.remainingByEventId),
    leftoverEvents: new Map(draft.leftoverEvents),
    proposedEventIds: new Set(draft.proposedEventIds),
    objective: {
      coverage: draft.objective.coverage,
      penalties: [...draft.objective.penalties],
    },
    recency: cloneRecency(draft.recency),
    blocks: [...draft.blocks],
    open: new Set(draft.open),
  }
}

function withAssignment(
  draft: Draft,
  row: RequestedGenerationSlot,
  candidate: CompositionCandidate,
  assignment: SlotAssignment,
  eligible: readonly CompositionCandidate[],
  ctx: ScoringContext,
): Draft {
  const next = cloneDraft(draft)
  const recipes = recipesInComposition(candidate)
  const leftoverRecipes = leftoverRecipesInComposition(candidate)
  next.cooksByDate.set(row.slot.date, (next.cooksByDate.get(row.slot.date) ?? 0) + recipes.length)
  const demandingAdded = recipes.filter((recipe) => recipe.effort === 'demanding').length
  if (demandingAdded > 0) {
    next.demandingByDate.set(
      row.slot.date,
      (next.demandingByDate.get(row.slot.date) ?? 0) + demandingAdded,
    )
  }
  for (const component of assignment.components) {
    if (component.type === 'leftover') {
      const remaining = next.remainingByEventId.get(component.cookingEventId)
      if (!remaining || remaining.unit !== component.allocatedQuantity.unit) continue
      const nextRemaining = {
        value: remaining.value - component.allocatedQuantity.value,
        unit: remaining.unit,
      }
      next.remainingByEventId.set(component.cookingEventId, nextRemaining)
      const event = next.leftoverEvents.get(component.cookingEventId)
      if (event)
        next.leftoverEvents.set(component.cookingEventId, { ...event, remaining: nextRemaining })
    } else if (
      component.type === 'recipe' &&
      component.proposedEventId &&
      component.outputQuantity.unit === component.allocatedQuantity.unit &&
      component.outputQuantity.value > component.allocatedQuantity.value
    ) {
      const extra = {
        value: component.outputQuantity.value - component.allocatedQuantity.value,
        unit: component.outputQuantity.unit,
      }
      const recipe = recipes.find((item) => item.id === component.recipeId)
      if (!recipe) continue
      next.remainingByEventId.set(component.proposedEventId, extra)
      next.proposedEventIds.add(component.proposedEventId)
      next.leftoverEvents.set(component.proposedEventId, {
        id: component.proposedEventId,
        recipeId: component.recipeId,
        recipeName: component.recipeName,
        scheduledDate: row.slot.date,
        outputQuantity: { ...component.outputQuantity },
        remaining: extra,
        desiredQuantity: { ...component.allocatedQuantity },
        reusePolicy: recipe.reusePolicy,
        mealTypes: recipe.mealTypes,
        recipe,
        role: component.role,
        proposed: true,
        producerSlotId: row.slot.id,
      })
    }
  }
  const scored = scoreable(candidate)
  next.assignments.push({
    ...assignment,
    scoreReasons: scoreReasonsForComposition(scored, eligible.map(scoreable), ctx),
  })
  next.weekRecipeIds.push(
    ...recipes.map((recipe) => recipe.id),
    ...leftoverRecipes.map((recipe) => recipe.id),
  )
  next.weekFoodIds.push(...foodsInComposition(candidate).map((food) => food.id))
  next.objective = addAssignmentToObjective(next.objective, compositionScoreTuple(scored, ctx))
  next.open.delete(row.slot.id)
  const mainRecipe = recipes[0] ?? leftoverRecipes[0]
  if (mainRecipe) rememberUse(next.recency, 'main', mainRecipe.id, row.slot.date)
  const companion = recipes[1] ?? foodsInComposition(candidate)[0]
  if (companion && 'id' in companion) {
    rememberUse(next.recency, 'accompaniment', companion.id, row.slot.date)
  }
  rememberUse(next.recency, 'composition', candidate.id, row.slot.date)
  if (recipes.length > 0) {
    rememberUse(next.recency, 'recook', `${recipes[0].id}:${row.slot.mealType}`, row.slot.date)
  }
  return next
}

function withUnfilled(
  draft: Draft,
  row: RequestedGenerationSlot,
  reason: UnfilledSlot['reason'],
): Draft {
  const next = cloneDraft(draft)
  next.unfilled.push({ slotId: row.slot.id, mealType: row.slot.mealType, reason })
  next.open.delete(row.slot.id)
  return next
}

function initialDraft(
  input: GenerationInput,
  requested: readonly RequestedGenerationSlot[],
): Draft {
  const weekRecipeIds = [
    ...(input.fixedMeals ?? []).flatMap((meal) => (meal.recipeId ? [meal.recipeId] : [])),
  ]
  const weekFoodIds = [
    ...(input.fixedMeals ?? []).flatMap((meal) => (meal.simpleFood ? [meal.simpleFood.id] : [])),
  ]
  const demandingByDate = new Map<string, number>()
  const cooksByDate = new Map<string, number>()
  const recency = emptyRecency()
  for (const meal of input.fixedMeals ?? []) {
    cooksByDate.set(meal.date, (cooksByDate.get(meal.date) ?? 0) + (meal.recipeId ? 1 : 0))
    if (meal.recipe?.effort === 'demanding') {
      demandingByDate.set(meal.date, (demandingByDate.get(meal.date) ?? 0) + 1)
    }
    if (meal.recipeId) rememberUse(recency, 'main', meal.recipeId, meal.date)
  }
  const open = new Set<string>()
  for (const row of requested) {
    const issue = validateSlotForGeneration(row.slot, row.componentCount, input.generationMode)
    if (!issue) open.add(row.slot.id)
  }
  return {
    assignments: [],
    unfilled: requested
      .filter((row) => !open.has(row.slot.id))
      .map((row) => ({
        slotId: row.slot.id,
        mealType: row.slot.mealType,
        reason: 'no-eligible-candidates' as const,
      })),
    weekRecipeIds,
    weekFoodIds,
    demandingByDate,
    cooksByDate,
    remainingByEventId: new Map(
      (input.cookingEvents ?? []).map((event) => [event.id, { ...event.remaining }]),
    ),
    leftoverEvents: new Map(
      (input.cookingEvents ?? []).map((event) => [
        event.id,
        { ...event, remaining: { ...event.remaining } },
      ]),
    ),
    proposedEventIds: new Set(),
    objective: emptyWeekObjective(),
    recency,
    blocks: [],
    open,
  }
}

function proposedRemainders(draft: Draft) {
  const remainders: NonNullable<WeekGenerationProposal['diagnostics']['unallocatedRemainders']> = []
  for (const id of draft.proposedEventIds) {
    const remaining = draft.remainingByEventId.get(id)
    const event = draft.leftoverEvents.get(id)
    if (!remaining || remaining.value <= 1e-9 || !event) continue
    remainders.push({
      proposedEventId: id,
      recipeName: event.recipeName,
      remaining: { ...remaining },
    })
  }
  return remainders
}

function remainingPenalty(draft: Draft, policy: GenerationBatchPolicy): number {
  const remainders = proposedRemainders(draft)
  if (remainders.length === 0) return 0
  if (policy.unallocatedProduction === 'disallow') return 1_000
  return remainders.length
}

function proposedEventsFromDraft(draft: Draft): ProposedCookingEvent[] {
  const events: ProposedCookingEvent[] = []
  for (const id of draft.proposedEventIds) {
    const event = draft.leftoverEvents.get(id)
    if (!event || !event.producerSlotId) continue
    events.push({
      id,
      recipeId: event.recipeId,
      recipeName: event.recipeName,
      scheduledDate: event.scheduledDate,
      outputQuantity: { ...event.outputQuantity },
      producerSlotId: event.producerSlotId,
    })
  }
  return events.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

function capacityNotes(draft: Draft): CapacityNote[] {
  const dates = [...new Set([...draft.cooksByDate.keys()])].sort()
  return dates.map((date) => ({
    date,
    cookCount: draft.cooksByDate.get(date) ?? 0,
    effortUnits: effortUnits(draft.cooksByDate.get(date) ?? 0),
  }))
}

function assignmentValid(assignment: SlotAssignment): boolean {
  return assignment.components.every((component) =>
    component.type === 'recipe'
      ? isValidPositiveQuantity(component.outputQuantity) &&
        isValidPositiveQuantity(component.allocatedQuantity)
      : isValidPositiveQuantity(component.allocatedQuantity),
  )
}

function limitedEqualScore(
  eligible: readonly CompositionCandidate[],
  ctx: ScoringContext,
  limit: number,
  random: () => number,
): CompositionCandidate[] {
  const ranked = [...eligible].sort((a, b) => {
    const tuple = compareScoreTuples(
      compositionScoreTuple(scoreable(a), ctx),
      compositionScoreTuple(scoreable(b), ctx),
    )
    if (tuple !== 0) return tuple
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
  const groups: CompositionCandidate[][] = []
  for (const candidate of ranked) {
    const last = groups[groups.length - 1]
    const candidateKey = compositionScoreTuple(scoreable(candidate), ctx).slice(
      0,
      GENERATION_PREF_TUPLE_LENGTH,
    )
    if (
      last &&
      compareScoreTuples(
        candidateKey,
        compositionScoreTuple(scoreable(last[0]), ctx).slice(0, GENERATION_PREF_TUPLE_LENGTH),
      ) === 0
    ) {
      last.push(candidate)
    } else {
      groups.push([candidate])
    }
  }
  return groups.flatMap((group) => seededShuffle(group, random)).slice(0, limit)
}

function lookaheadDesired(
  recipe: GenerationLeftoverEvent['recipe'],
  cookDate: string,
  laterRows: readonly RequestedGenerationSlot[],
  input: GenerationInput,
  scale: ScaleQuantity,
  unit: string,
): Quantity[] {
  const out: Quantity[] = []
  for (const later of laterRows) {
    if (!recipe.mealTypes.includes(later.slot.mealType)) continue
    if (!isReuseAllowed(recipe.reusePolicy, cookDate, later.slot.date)) continue
    const desired = scale(recipe.defaultPortionPerPerson, input.peopleCount)
    if (!desired || desired.value <= 0 || desired.unit !== unit) continue
    const override = input.quantityOverrides?.[later.slot.id]
    if (override && override.unit !== unit) continue
    out.push(desired)
  }
  return out
}

function laterOpenRows(
  target: RequestedGenerationSlot,
  requested: readonly RequestedGenerationSlot[],
  draft: Draft,
): RequestedGenerationSlot[] {
  return requested.filter((row) => {
    if (!draft.open.has(row.slot.id)) return false
    if (row.slot.id === target.slot.id) return false
    if (row.slot.date < target.slot.date) return false
    if (
      row.slot.date === target.slot.date &&
      MEAL_ORDER[row.slot.mealType] <= MEAL_ORDER[target.slot.mealType]
    ) {
      return false
    }
    return true
  })
}

function batchableRecipe(candidate: CompositionCandidate) {
  if (candidate.source.type === 'leftover') return undefined
  const recipeParts = candidate.parts.filter((part) => part.type === 'recipe')
  if (recipeParts.length === 0) return undefined
  const main = recipeParts.find(
    (part) => part.type === 'recipe' && part.recipe.roles.includes('main'),
  )
  if (main?.type === 'recipe') return main.recipe
  const first = recipeParts[0]
  return first?.type === 'recipe' ? first.recipe : undefined
}

/** Extra leftover meals needed to cook one recipe yield when yield is a multiple of this meal. */
function yieldFillExtraMeals(recipe: { yield: Quantity }, mealPortion: Quantity): number {
  if (recipe.yield.unit !== mealPortion.unit || mealPortion.value <= 0) return 0
  const meals = recipe.yield.value / mealPortion.value
  if (!Number.isInteger(meals) || meals < 2) return 0
  return meals - 1
}

function extraQuantityForUses(
  later: readonly Quantity[],
  n: number,
  unit: string,
): Quantity | undefined {
  if (n <= 0) return undefined
  const extraValue = later.slice(0, n).reduce((sum, quantity) => sum + quantity.value, 0)
  if (extraValue <= 0) return undefined
  return { value: extraValue, unit }
}

function expandBatchVariants(
  enumerated: readonly CompositionCandidate[],
  input: GenerationInput,
  row: RequestedGenerationSlot,
  laterRows: readonly RequestedGenerationSlot[],
  scale: ScaleQuantity,
): CompositionCandidate[] {
  const policy = mergeGenerationBatchPolicy(input.batchPolicy)
  const out: CompositionCandidate[] = []
  for (const candidate of enumerated) {
    out.push(candidate)
    const recipe = batchableRecipe(candidate)
    if (!recipe || recipe.reusePolicy !== 'batch-friendly') continue
    const thisQuantity =
      input.quantityOverrides?.[row.slot.id] ??
      scale(recipe.defaultPortionPerPerson, input.peopleCount)
    if (!thisQuantity || thisQuantity.value <= 0) continue
    const later = lookaheadDesired(
      recipe,
      row.slot.date,
      laterRows,
      input,
      scale,
      thisQuantity.unit,
    )
    if (later.length === 0) continue
    const yieldExtra = yieldFillExtraMeals(recipe, thisQuantity)
    const maxN = Math.min(later.length, Math.max(policy.maxExtraPlannedUses, yieldExtra))
    for (let n = 1; n <= maxN; n++) {
      const extraQuantity = extraQuantityForUses(later, n, thisQuantity.unit)
      if (!extraQuantity) continue
      out.push({
        ...candidate,
        id: `${candidate.id}:extra:${n}`,
        extraUses: n,
        extraQuantity,
        extraRecipeId: recipe.id,
        proposedEventId: `${row.slot.id}:${recipe.id}`,
      })
    }
  }
  return out
}

function attachCompanion(
  candidate: CompositionCandidate,
  companion: ReturnType<typeof knownCompanions>[number] | undefined,
): CompositionCandidate {
  if (!companion) return candidate
  if (
    candidate.parts.some(
      (part) =>
        part.type === companion.part.type &&
        ((part.type === 'recipe' &&
          companion.part.type === 'recipe' &&
          part.recipe.id === companion.part.recipe.id) ||
          (part.type === 'simple-food' &&
            companion.part.type === 'simple-food' &&
            part.food.id === companion.part.food.id)),
    )
  ) {
    return candidate
  }
  return {
    ...candidate,
    id: `${candidate.id}+${companion.id}`,
    parts: [...candidate.parts, companion.part],
  }
}

function pickCompanion(
  main: { id: string; roles: readonly string[] },
  input: GenerationInput,
  row: RequestedGenerationSlot,
  draft: Draft,
  usedCompanionIds: ReadonlySet<string>,
): ReturnType<typeof knownCompanions>[number] | undefined {
  const companions = knownCompanions(main.id, input, row.slot.mealType)
  if (companions.length === 0) return undefined
  const ranked = [...companions].sort((a, b) => {
    const aId = a.part.type === 'recipe' ? a.part.recipe.id : a.part.food.id
    const bId = b.part.type === 'recipe' ? b.part.recipe.id : b.part.food.id
    const used = Number(usedCompanionIds.has(aId)) - Number(usedCompanionIds.has(bId))
    if (used !== 0) return used
    const recency =
      recencyPenalty(draft.recency, 'accompaniment', aId, row.slot.date) -
      recencyPenalty(draft.recency, 'accompaniment', bId, row.slot.date)
    if (recency !== 0) return recency
    const load = resolveDayLoad(row.slot.date, input)
    if (load === 'busy') {
      const effortA = a.part.type === 'recipe' ? a.part.recipe.effort : 'quick'
      const effortB = b.part.type === 'recipe' ? b.part.recipe.effort : 'quick'
      const rank = (effort: string) => (effort === 'quick' ? 0 : effort === 'demanding' ? 2 : 1)
      const effort = rank(effortA) - rank(effortB)
      if (effort !== 0) return effort
    }
    return a.id < b.id ? -1 : 1
  })
  return ranked[0]
}

function completeCandidate(
  candidate: CompositionCandidate,
  input: GenerationInput,
  row: RequestedGenerationSlot,
  draft: Draft,
  usedCompanionIds: ReadonlySet<string>,
): CompositionCandidate {
  const recipes = recipesInComposition(candidate)
  const leftovers = leftoverRecipesInComposition(candidate)
  const main = recipes[0] ?? leftovers[0]
  if (!main) return candidate
  const needsSide =
    main.roles.includes('main') && !main.roles.includes('complete') && candidate.parts.length === 1
  if (!needsSide && candidate.parts.length > 1) return candidate
  if (!needsSide && main.roles.includes('complete')) {
    const companion = pickCompanion(main, input, row, draft, usedCompanionIds)
    if (!companion) return candidate
    if (resolveDayLoad(row.slot.date, input) === 'busy') return candidate
    return attachCompanion(candidate, companion)
  }
  if (!needsSide) return candidate
  const companion = pickCompanion(main, input, row, draft, usedCompanionIds)
  if (!companion) return candidate
  const completed = attachCompanion(candidate, companion)
  if (companion.favoriteId && candidate.source.type === 'standalone') {
    return {
      ...completed,
      source: {
        type: 'favorite',
        favoriteId: companion.favoriteId,
        favoriteName: companion.favoriteName ?? companion.favoriteId,
      },
    }
  }
  if (companion.pairingId && candidate.source.type === 'standalone') {
    return { ...completed, source: { type: 'pairing', pairingId: companion.pairingId } }
  }
  return completed
}

function candidateCountForSlot(
  input: GenerationInput,
  draft: Draft,
  row: RequestedGenerationSlot,
): number {
  return enumerateCompositionCandidates(
    cookingInputForDraft(input, draft),
    row.slot.mealType,
    row.slot.date,
  ).length
}

function leftoverAvailable(
  input: GenerationInput,
  draft: Draft,
  row: RequestedGenerationSlot,
): boolean {
  return enumerateCompositionCandidates(
    cookingInputForDraft(input, draft),
    row.slot.mealType,
    row.slot.date,
  ).some((candidate) => candidate.source.type === 'leftover')
}

function chooseNextTarget(
  requested: readonly RequestedGenerationSlot[],
  draft: Draft,
  input: GenerationInput,
): RequestedGenerationSlot | undefined {
  const open = requested.filter((row) => draft.open.has(row.slot.id))
  if (open.length === 0) return undefined
  const withLeftover = open.filter((row) => leftoverAvailable(input, draft, row))
  if (withLeftover.length > 0) {
    return sortRequestedSlots(withLeftover)[0]
  }
  const mains = open.filter((row) => row.slot.mealType !== 'breakfast')
  const pool = mains.length > 0 ? mains : open
  const ranked = [...pool].sort((a, b) => {
    const count = candidateCountForSlot(input, draft, a) - candidateCountForSlot(input, draft, b)
    if (count !== 0) return count
    const loadA = resolveDayLoad(a.slot.date, input) === 'free' ? 0 : 1
    const loadB = resolveDayLoad(b.slot.date, input) === 'free' ? 0 : 1
    if (loadA !== loadB) return loadA - loadB
    if (a.slot.date !== b.slot.date) return a.slot.date < b.slot.date ? -1 : 1
    return MEAL_ORDER[a.slot.mealType] - MEAL_ORDER[b.slot.mealType]
  })
  return ranked[0]
}

function proposeForTarget(
  input: GenerationInput,
  draft: Draft,
  row: RequestedGenerationSlot,
  requested: readonly RequestedGenerationSlot[],
  scale: ScaleQuantity,
  capabilities: CapabilityInventory,
  random: () => number,
  limit: number,
): CompositionCandidate[] {
  const later = laterOpenRows(row, requested, draft)
  if (row.slot.mealType === 'breakfast') {
    const patterns = rotateBreakfastPattern(
      breakfastPatterns(input, capabilities),
      draft.recency,
      row.slot.date,
      row.slot.mealType,
    )
    const enumerated = patterns
      .map(patternToCandidate)
      .filter((candidate) => leftoverFitsRemaining(candidate, draft.remainingByEventId))
    const ctx = scoringContext(input, row, draft)
    return limitedEqualScore(enumerated, ctx, limit, random)
  }
  const enumerated = enumerateCompositionCandidates(
    cookingInputForDraft(input, draft),
    row.slot.mealType,
    row.slot.date,
  )
  const expanded = expandBatchVariants(enumerated, input, row, later, scale).filter((candidate) =>
    leftoverFitsRemaining(candidate, draft.remainingByEventId),
  )
  const ctx = scoringContext(input, row, draft)
  const completed = expanded.map((candidate) =>
    completeCandidate(candidate, input, row, draft, new Set()),
  )
  const unique = new Map<string, CompositionCandidate>()
  for (const candidate of completed) unique.set(candidate.id, candidate)
  return limitedEqualScore([...unique.values()], ctx, limit, random)
}

function applyCandidateChain(
  input: GenerationInput,
  draft: Draft,
  producer: RequestedGenerationSlot,
  candidate: CompositionCandidate,
  requested: readonly RequestedGenerationSlot[],
  scale: ScaleQuantity,
): Draft | undefined {
  const ctx = scoringContext(input, producer, draft)
  const assignment = assignmentFromCandidate(
    candidate,
    producer.slot.id,
    producer.slot.mealType,
    input.peopleCount,
    scale,
    input.quantityOverrides?.[producer.slot.id],
    draft.remainingByEventId,
  )
  if (!assignment || !assignmentValid(assignment)) return undefined
  const eligible = enumerateCompositionCandidates(
    cookingInputForDraft(input, draft),
    producer.slot.mealType,
    producer.slot.date,
  )
  let next = withAssignment(draft, producer, candidate, assignment, eligible, ctx)
  const extraUses = candidate.extraUses ?? 0
  const recipe = batchableRecipe(candidate)
  const eventId = candidate.proposedEventId
  const usedSides = new Set<string>()
  for (const part of candidate.parts) {
    if (part.type === 'recipe' && recipe && part.recipe.id !== recipe.id)
      usedSides.add(part.recipe.id)
    if (part.type === 'simple-food') usedSides.add(part.food.id)
  }
  if (extraUses > 0 && recipe && eventId) {
    const later = laterOpenRows(producer, requested, next).filter(
      (row) =>
        recipe.mealTypes.includes(row.slot.mealType) &&
        isReuseAllowed(recipe.reusePolicy, producer.slot.date, row.slot.date),
    )
    let consumed = 0
    for (const laterRow of later) {
      if (consumed >= extraUses) break
      const remaining = next.remainingByEventId.get(eventId)
      if (!remaining || remaining.value <= 0) break
      const laterDesired =
        input.quantityOverrides?.[laterRow.slot.id] ??
        scale(recipe.defaultPortionPerPerson, input.peopleCount) ??
        remaining
      let leftoverCandidate: CompositionCandidate = {
        id: `leftover:${eventId}`,
        source: { type: 'leftover', cookingEventId: eventId },
        parts: [
          {
            type: 'leftover',
            eventId,
            recipe,
            recipeName: recipe.name,
            scheduledDate: producer.slot.date,
            desiredQuantity: laterDesired,
            proposed: true,
          },
        ],
      }
      leftoverCandidate = completeCandidate(leftoverCandidate, input, laterRow, next, usedSides)
      let laterAssignment = assignmentFromCandidate(
        leftoverCandidate,
        laterRow.slot.id,
        laterRow.slot.mealType,
        input.peopleCount,
        scale,
        input.quantityOverrides?.[laterRow.slot.id],
        next.remainingByEventId,
      )
      if (!laterAssignment || !assignmentValid(laterAssignment)) {
        leftoverCandidate = {
          id: `leftover:${eventId}`,
          source: { type: 'leftover', cookingEventId: eventId },
          parts: [
            {
              type: 'leftover',
              eventId,
              recipe,
              recipeName: recipe.name,
              scheduledDate: producer.slot.date,
              desiredQuantity: laterDesired,
              proposed: true,
            },
          ],
        }
        laterAssignment = assignmentFromCandidate(
          leftoverCandidate,
          laterRow.slot.id,
          laterRow.slot.mealType,
          input.peopleCount,
          scale,
          input.quantityOverrides?.[laterRow.slot.id],
          next.remainingByEventId,
        )
      }
      if (!laterAssignment || !assignmentValid(laterAssignment)) continue
      const laterCtx = scoringContext(input, laterRow, next)
      next = withAssignment(
        next,
        laterRow,
        leftoverCandidate,
        laterAssignment,
        [leftoverCandidate],
        laterCtx,
      )
      consumed += 1
      for (const part of leftoverCandidate.parts) {
        if (part.type === 'recipe') usedSides.add(part.recipe.id)
        if (part.type === 'simple-food') usedSides.add(part.food.id)
      }
    }
  }
  const namedRecipe =
    recipe ?? leftoverRecipesInComposition(candidate)[0] ?? recipesInComposition(candidate)[0]
  const namedFood = foodsInComposition(candidate)[0]
  const leftoverName = assignment.components.find(
    (component) => component.type === 'leftover' || component.type === 'recipe',
  )
  next.blocks.push({
    id: candidate.id,
    kind:
      producer.slot.mealType === 'breakfast'
        ? 'breakfast'
        : candidate.source.type === 'leftover'
          ? 'leftover'
          : 'main',
    recipe: namedRecipe ?? {
      id: namedFood?.id ?? candidate.id,
      name:
        namedFood?.name ??
        (leftoverName && 'recipeName' in leftoverName ? leftoverName.recipeName : candidate.id),
      yield: { value: 1, unit: 'serving' },
      defaultPortionPerPerson: { value: 1, unit: 'serving' },
      ingredientLines: [],
      instructions: '',
      roles: ['complete'],
      mealTypes: [producer.slot.mealType],
      effort: 'regular',
      reusePolicy: 'fresh-only',
      freezerFriendly: false,
      tagIds: [],
      createdAt: 0,
      updatedAt: 0,
    },
    prepareSlotId: producer.slot.id,
    prepareDate: producer.slot.date,
    production: assignment.components.find((component) => component.type === 'recipe')
      ?.outputQuantity ??
      assignment.components[0]?.allocatedQuantity ?? { value: 0, unit: 'serving' },
    consumptions: next.assignments
      .filter(
        (row) =>
          row.slotId === producer.slot.id ||
          (eventId &&
            row.components.some(
              (component) => component.type === 'leftover' && component.proposedEventId === eventId,
            )),
      )
      .map((row) => ({
        slotId: row.slotId,
        date:
          requested.find((item) => item.slot.id === row.slotId)?.slot.date ?? producer.slot.date,
        mealType: row.mealType,
        allocated: row.components[0]?.allocatedQuantity ?? { value: 0, unit: 'serving' },
      })),
  })
  return next
}

function tryRepair(
  input: GenerationInput,
  row: RequestedGenerationSlot,
  failed: CompositionCandidate,
): CompositionCandidate | undefined {
  if (failed.extraUses && failed.extraUses > 0) {
    const nextN = failed.extraUses - 1
    if (nextN <= 0 || !failed.extraQuantity) {
      return {
        ...failed,
        extraUses: undefined,
        extraQuantity: undefined,
        extraRecipeId: undefined,
        proposedEventId: undefined,
        id: failed.id.replace(/:extra:\d+$/, ''),
      }
    }
    const perUse = failed.extraQuantity.value / failed.extraUses
    return {
      ...failed,
      extraUses: nextN,
      extraQuantity: { value: perUse * nextN, unit: failed.extraQuantity.unit },
      id: failed.id.replace(/:extra:\d+$/, `:extra:${nextN}`),
    }
  }
  const companions = knownCompanions(
    recipesInComposition(failed)[0]?.id ?? leftoverRecipesInComposition(failed)[0]?.id ?? '',
    input,
    row.slot.mealType,
  )
  if (companions.length > 1) {
    return attachCompanion(
      {
        ...failed,
        parts: failed.parts.filter(
          (part) =>
            part.type === 'leftover' ||
            (part.type === 'recipe' &&
              recipesInComposition(failed)[0] &&
              part.recipe.id === recipesInComposition(failed)[0].id),
        ),
      },
      companions[1],
    )
  }
  return undefined
}

function finishProposal(
  input: GenerationInput,
  requestId: string,
  draft: Draft,
  requested: readonly RequestedGenerationSlot[],
  expansionsUsed: number,
): WeekGenerationProposal {
  const unfilled = [...draft.unfilled]
  const assigned = new Set(draft.assignments.map((row) => row.slotId))
  const alreadyUnfilled = new Set(unfilled.map((row) => row.slotId))
  for (const row of requested) {
    if (assigned.has(row.slot.id) || alreadyUnfilled.has(row.slot.id)) continue
    unfilled.push({
      slotId: row.slot.id,
      mealType: row.slot.mealType,
      reason: 'search-incomplete',
    })
  }
  const policy = input.policy ?? DEFAULT_GENERATION_HARD_POLICY
  const catalogs = input.catalogs ?? {
    recipeIds: input.recipes.map((recipe) => recipe.id),
    tagIds: [],
    ingredientIds: [],
  }
  const diagnostics = buildGenerationDiagnostics(
    input.recipes,
    input.requestedSlots.map((row) => row.slot.mealType),
    policy,
    input.fixedMeals ?? [],
    catalogs,
  )
  const remainders = proposedRemainders(draft)
  if (remainders.length > 0) diagnostics.unallocatedRemainders = remainders
  const assignments = [...draft.assignments].sort((a, b) => {
    const rowA = requested.find((row) => row.slot.id === a.slotId)
    const rowB = requested.find((row) => row.slot.id === b.slotId)
    if (!rowA || !rowB) return a.slotId < b.slotId ? -1 : 1
    if (rowA.slot.date !== rowB.slot.date) return rowA.slot.date < rowB.slot.date ? -1 : 1
    const meal = MEAL_ORDER[rowA.slot.mealType] - MEAL_ORDER[rowB.slot.mealType]
    if (meal !== 0) return meal
    return a.slotId < b.slotId ? -1 : 1
  })
  const proposal: WeekGenerationProposal = {
    requestId,
    algorithmVersion: GENERATION_ALGORITHM_VERSION,
    policyVersion: GENERATION_POLICY_VERSION,
    seed: input.seed,
    fingerprint: fingerprintFromInput(input),
    planId: input.planId,
    quantityOverrides: input.quantityOverrides,
    assignments,
    unfilled,
    diagnostics,
    budgetUsed: mergeGenerationSearchBudget(input.searchBudget),
    expansionsUsed,
    proposedCookingEvents: proposedEventsFromDraft(draft),
    cookingBlocks: draft.blocks.map(cookingBlockPreview),
    capacityNotes: capacityNotes(draft),
    generationMode: mergeGenerationMode(input.generationMode),
    replacementPreview: replacementPreviewFromInput(input),
    presetId: input.presetId,
    generationConfig: input.generationConfig,
    generationSessionId: input.generationSessionId,
    dayLoad: input.dayLoad,
  }
  const issue = validateProposalAgainstLive(proposal, input)
  if (issue) {
    throw new Error(`generation search produced an invalid proposal: ${issue}`)
  }
  return proposal
}

function replacementPreviewFromInput(input: GenerationInput) {
  if (mergeGenerationMode(input.generationMode) !== 'replace') return undefined
  return input.requestedSlots
    .filter((row) => (row.existingLabels?.length ?? 0) > 0)
    .map((row) => ({
      slotId: row.slot.id,
      date: row.slot.date,
      mealType: row.slot.mealType,
      removedNames: [...(row.existingLabels ?? [])],
    }))
}

function objectiveForDraft(draft: Draft, policy: GenerationBatchPolicy): WeekObjective {
  const penalty = remainingPenalty(draft, policy)
  if (penalty === 0) return draft.objective
  return { coverage: draft.objective.coverage, penalties: [...draft.objective.penalties, penalty] }
}

export function runIndependentGreedySearch(
  input: GenerationInput,
  requestId: string,
  scale: ScaleQuantity,
): WeekGenerationProposal {
  return runGenerationSearch(
    {
      ...input,
      searchBudget: { beamWidth: 1, perSlotCandidateLimit: 1, expansionBudget: 10_000 },
    },
    requestId,
    scale,
  )
}

export function weekObjectiveForAssignments(
  input: GenerationInput,
  assignments: readonly SlotAssignment[],
): WeekObjective {
  const requested = sortRequestedSlots(input.requestedSlots)
  const bySlot = new Map(assignments.map((row) => [row.slotId, row]))
  let draft = initialDraft(input, requested)
  draft.open = new Set(requested.map((row) => row.slot.id))
  let objective = emptyWeekObjective()
  for (const row of requested) {
    const assignment = bySlot.get(row.slot.id)
    if (!assignment) continue
    const ctx = scoringContext(input, row, draft)
    const eligible = enumerateCompositionCandidates(
      cookingInputForDraft(input, draft),
      row.slot.mealType,
      row.slot.date,
    )
    const candidate = eligible.find((item) =>
      assignment.components.every((component, index) => {
        const part = item.parts[index]
        if (component.type === 'recipe') {
          return part?.type === 'recipe' && part.recipe.id === component.recipeId
        }
        if (component.type === 'leftover') {
          return part?.type === 'leftover' && part.eventId === component.cookingEventId
        }
        return part?.type === 'simple-food' && part.food.id === component.simpleFoodId
      }),
    )
    if (!candidate) continue
    objective = addAssignmentToObjective(
      objective,
      compositionScoreTuple(scoreable(candidate), ctx),
    )
    draft = withAssignment(draft, row, candidate, assignment, eligible, ctx)
  }
  return objective
}

export function runGenerationSearch(
  input: GenerationInput,
  requestId: string,
  scale: ScaleQuantity,
): WeekGenerationProposal {
  const budget = mergeGenerationSearchBudget(input.searchBudget)
  const batchPolicy = mergeGenerationBatchPolicy(input.batchPolicy)
  const requested = sortRequestedSlots(input.requestedSlots)
  const random = mulberry32(hashSeed(input.seed))
  const capabilities = analyzeCatalog(input)
  buildWeekStructure(input, capabilities)
  let draft = initialDraft(input, requested)
  let expansionsUsed = 0
  let exhausted = false
  const alternativesKept: CompositionCandidate[] = []

  while (draft.open.size > 0) {
    if (exhausted) break
    const target = chooseNextTarget(requested, draft, input)
    if (!target) break
    const alternatives = proposeForTarget(
      input,
      draft,
      target,
      requested,
      scale,
      capabilities,
      random,
      budget.perSlotCandidateLimit,
    )
    if (alternatives.length === 0) {
      draft = withUnfilled(draft, target, 'no-eligible-candidates')
      continue
    }
    let applied: Draft | undefined
    let lastFailed: CompositionCandidate | undefined
    for (const candidate of alternatives) {
      if (expansionsUsed >= budget.expansionBudget) {
        exhausted = true
        break
      }
      expansionsUsed += 1
      const next = applyCandidateChain(input, draft, target, candidate, requested, scale)
      if (!next) {
        lastFailed = candidate
        continue
      }
      if (remainingPenalty(next, batchPolicy) >= 1_000 && candidate.extraUses) {
        lastFailed = candidate
        continue
      }
      if (!applied) {
        applied = next
        alternativesKept.length = 0
        alternativesKept.push(candidate)
      } else if (
        compareWeekObjectives(
          objectiveForDraft(next, batchPolicy),
          objectiveForDraft(applied, batchPolicy),
        ) < 0
      ) {
        applied = next
      }
      if (alternativesKept.length < budget.beamWidth) alternativesKept.push(candidate)
      if (budget.beamWidth <= 1) break
    }
    if (!applied && lastFailed && !exhausted) {
      const repaired = tryRepair(input, target, lastFailed)
      if (repaired && expansionsUsed < budget.expansionBudget) {
        expansionsUsed += 1
        applied = applyCandidateChain(input, draft, target, repaired, requested, scale)
      }
    }
    if (applied) {
      const prefs = input.softPrefs ?? DEFAULT_GENERATION_SOFT_PREFS
      const date = target.slot.date
      const units = effortUnits(applied.cooksByDate.get(date) ?? 0)
      if (units > prefs.maxBatchPrepUnits + 2) {
        draft = withUnfilled(draft, target, 'capacity-exhausted')
      } else {
        draft = applied
      }
    } else if (exhausted) {
      draft = withUnfilled(draft, target, 'search-incomplete')
    } else {
      draft = withUnfilled(draft, target, 'no-eligible-candidates')
    }
  }

  return finishProposal(input, requestId, draft, requested, expansionsUsed)
}
