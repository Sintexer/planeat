import type { Quantity } from '../../shared/Quantity'
import type { MealSlot } from '../MealSlot'
import {
  assignmentFromCandidate,
  enumerateCompositionCandidates,
  foodsInComposition,
  leftoverRecipesInComposition,
  recipesInComposition,
  type CompositionCandidate,
} from './compositions'
import { buildGenerationDiagnostics, DEFAULT_GENERATION_HARD_POLICY } from './constraints'
import {
  fingerprintFromInput,
  GENERATION_ALGORITHM_VERSION,
  GENERATION_POLICY_VERSION,
  mergeGenerationSearchBudget,
  type GenerationInput,
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
  addAssignmentToObjective,
  compositionScoreTuple,
  compareScoreTuples,
  compareWeekObjectives,
  DEFAULT_GENERATION_SOFT_PREFS,
  emptyWeekObjective,
  scoreReasonsForComposition,
  type ScoreableComposition,
  type ScoringContext,
  type WeekObjective,
} from './scoring'

export type ScaleQuantity = (quantity: Quantity | null, factor: number) => Quantity | null

const MEAL_ORDER = { breakfast: 0, lunch: 1, dinner: 2 } as const

type SearchNode = {
  nextSlotIndex: number
  assignments: SlotAssignment[]
  unfilled: UnfilledSlot[]
  weekRecipeIds: string[]
  demandingByDate: Map<string, number>
  cooksByDate: Map<string, number>
  remainingByEventId: Map<string, Quantity>
  objective: WeekObjective
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
  node: SearchNode,
): ScoringContext {
  return {
    date: row.slot.date,
    mealType: row.slot.mealType,
    prefs: input.softPrefs ?? DEFAULT_GENERATION_SOFT_PREFS,
    weekRecipeIds: node.weekRecipeIds,
    previousWeekRecipeIds: input.previousWeekRecipeIds ?? [],
    demandingCooksOnDate: node.demandingByDate.get(row.slot.date) ?? 0,
    cookingEventCountOnDate: node.cooksByDate.get(row.slot.date) ?? 0,
    tagNamesById: input.tagNamesById ?? {},
  }
}

function scoreable(candidate: CompositionCandidate): ScoreableComposition {
  return {
    id: candidate.id,
    recipes: recipesInComposition(candidate),
    foods: foodsInComposition(candidate),
    leftoverRecipes: leftoverRecipesInComposition(candidate),
  }
}

function limitedCandidates(
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
    if (
      last &&
      compareScoreTuples(
        compositionScoreTuple(scoreable(candidate), ctx),
        compositionScoreTuple(scoreable(last[0]), ctx),
      ) === 0
    ) {
      last.push(candidate)
    } else {
      groups.push([candidate])
    }
  }
  return groups.flatMap((group) => seededShuffle(group, random)).slice(0, limit)
}

function assignmentKey(node: SearchNode): string {
  const assigned = node.assignments
    .map((row) => {
      const ids = row.components
        .map((component) =>
          component.type === 'recipe'
            ? component.recipeId
            : component.type === 'leftover'
              ? `leftover:${component.cookingEventId}`
              : component.simpleFoodId,
        )
        .join('+')
      return `${row.slotId}:${ids}`
    })
    .sort()
    .join(',')
  const empty = node.unfilled
    .map((row) => `${row.slotId}:${row.reason}`)
    .sort()
    .join(',')
  return `${assigned}|${empty}`
}

function uniqueRecipeCount(node: SearchNode): number {
  return new Set(
    node.assignments.flatMap((row) =>
      row.components.flatMap((component) =>
        component.type === 'recipe'
          ? [component.recipeId]
          : component.type === 'leftover'
            ? [component.recipeId]
            : [],
      ),
    ),
  ).size
}

function pruneBeam(nodes: SearchNode[], width: number): SearchNode[] {
  return [...nodes]
    .sort((a, b) => {
      const objective = compareWeekObjectives(a.objective, b.objective)
      if (objective !== 0) return objective
      const diversity = uniqueRecipeCount(b) - uniqueRecipeCount(a)
      if (diversity !== 0) return diversity
      const keyA = assignmentKey(a)
      const keyB = assignmentKey(b)
      if (keyA < keyB) return -1
      if (keyA > keyB) return 1
      return 0
    })
    .slice(0, width)
}

function considerBest(best: SearchNode, candidate: SearchNode): SearchNode {
  const objective = compareWeekObjectives(candidate.objective, best.objective)
  if (objective < 0) return candidate
  if (objective > 0) return best
  if (candidate.nextSlotIndex > best.nextSlotIndex) return candidate
  return best
}

function withUnfilled(
  node: SearchNode,
  slot: MealSlot,
  reason: UnfilledSlot['reason'],
): SearchNode {
  return {
    ...node,
    nextSlotIndex: node.nextSlotIndex + 1,
    unfilled: [...node.unfilled, { slotId: slot.id, mealType: slot.mealType, reason }],
    demandingByDate: new Map(node.demandingByDate),
    cooksByDate: new Map(node.cooksByDate),
    remainingByEventId: new Map(node.remainingByEventId),
    weekRecipeIds: [...node.weekRecipeIds],
    assignments: [...node.assignments],
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

function withAssignment(
  node: SearchNode,
  row: RequestedGenerationSlot,
  candidate: CompositionCandidate,
  assignment: SlotAssignment,
  eligible: readonly CompositionCandidate[],
  ctx: ScoringContext,
): SearchNode {
  const recipes = recipesInComposition(candidate)
  const leftoverRecipes = leftoverRecipesInComposition(candidate)
  const cooksByDate = new Map(node.cooksByDate)
  const demandingByDate = new Map(node.demandingByDate)
  const remainingByEventId = new Map(node.remainingByEventId)
  cooksByDate.set(row.slot.date, (cooksByDate.get(row.slot.date) ?? 0) + recipes.length)
  const demandingAdded = recipes.filter((recipe) => recipe.effort === 'demanding').length
  if (demandingAdded > 0) {
    demandingByDate.set(row.slot.date, (demandingByDate.get(row.slot.date) ?? 0) + demandingAdded)
  }
  for (const component of assignment.components) {
    if (component.type !== 'leftover') continue
    const remaining = remainingByEventId.get(component.cookingEventId)
    if (!remaining || remaining.unit !== component.allocatedQuantity.unit) continue
    remainingByEventId.set(component.cookingEventId, {
      value: remaining.value - component.allocatedQuantity.value,
      unit: remaining.unit,
    })
  }
  const scored = scoreable(candidate)
  return {
    nextSlotIndex: node.nextSlotIndex + 1,
    assignments: [
      ...node.assignments,
      {
        ...assignment,
        scoreReasons: scoreReasonsForComposition(scored, eligible.map(scoreable), ctx),
      },
    ],
    unfilled: [...node.unfilled],
    weekRecipeIds: [
      ...node.weekRecipeIds,
      ...recipes.map((recipe) => recipe.id),
      ...leftoverRecipes.map((recipe) => recipe.id),
    ],
    demandingByDate,
    cooksByDate,
    remainingByEventId,
    objective: addAssignmentToObjective(node.objective, compositionScoreTuple(scored, ctx)),
  }
}

function initialNode(input: GenerationInput): SearchNode {
  const weekRecipeIds = [
    ...(input.fixedMeals ?? []).flatMap((meal) => (meal.recipeId ? [meal.recipeId] : [])),
  ]
  const demandingByDate = new Map<string, number>()
  const cooksByDate = new Map<string, number>()
  for (const meal of input.fixedMeals ?? []) {
    cooksByDate.set(meal.date, (cooksByDate.get(meal.date) ?? 0) + (meal.recipeId ? 1 : 0))
    if (meal.recipe?.effort === 'demanding') {
      demandingByDate.set(meal.date, (demandingByDate.get(meal.date) ?? 0) + 1)
    }
  }
  return {
    nextSlotIndex: 0,
    assignments: [],
    unfilled: [],
    weekRecipeIds,
    demandingByDate,
    cooksByDate,
    remainingByEventId: new Map(
      (input.cookingEvents ?? []).map((event) => [event.id, { ...event.remaining }]),
    ),
    objective: emptyWeekObjective(),
  }
}

function finishProposal(
  input: GenerationInput,
  requestId: string,
  node: SearchNode,
  requested: readonly RequestedGenerationSlot[],
  expansionsUsed: number,
): WeekGenerationProposal {
  const unfilled = [...node.unfilled]
  const assigned = new Set(node.assignments.map((row) => row.slotId))
  const alreadyUnfilled = new Set(unfilled.map((row) => row.slotId))
  for (let i = node.nextSlotIndex; i < requested.length; i++) {
    const slot = requested[i].slot
    if (assigned.has(slot.id) || alreadyUnfilled.has(slot.id)) continue
    unfilled.push({ slotId: slot.id, mealType: slot.mealType, reason: 'search-incomplete' })
  }
  const policy = input.policy ?? DEFAULT_GENERATION_HARD_POLICY
  const catalogs = input.catalogs ?? {
    recipeIds: input.recipes.map((recipe) => recipe.id),
    tagIds: [],
    ingredientIds: [],
  }
  const proposal: WeekGenerationProposal = {
    requestId,
    algorithmVersion: GENERATION_ALGORITHM_VERSION,
    policyVersion: GENERATION_POLICY_VERSION,
    seed: input.seed,
    fingerprint: fingerprintFromInput(input),
    planId: input.planId,
    quantityOverrides: input.quantityOverrides,
    assignments: node.assignments,
    unfilled,
    diagnostics: buildGenerationDiagnostics(
      input.recipes,
      input.requestedSlots.map((row) => row.slot.mealType),
      policy,
      input.fixedMeals ?? [],
      catalogs,
    ),
    budgetUsed: mergeGenerationSearchBudget(input.searchBudget),
    expansionsUsed,
  }
  const issue = validateProposalAgainstLive(proposal, input)
  if (issue) {
    throw new Error(`generation search produced an invalid proposal: ${issue}`)
  }
  return proposal
}

/** Sequential per-slot greedy with carried week state (Sprint 31). Test comparator only. */
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
  let node = initialNode(input)
  let objective = emptyWeekObjective()
  for (const row of requested) {
    const assignment = bySlot.get(row.slot.id)
    if (!assignment) continue
    const ctx = scoringContext(input, row, node)
    const eligible = enumerateCompositionCandidates(input, row.slot.mealType, row.slot.date)
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
    node = withAssignment(node, row, candidate, assignment, eligible, ctx)
  }
  return objective
}

export function runGenerationSearch(
  input: GenerationInput,
  requestId: string,
  scale: ScaleQuantity,
): WeekGenerationProposal {
  const budget = mergeGenerationSearchBudget(input.searchBudget)
  const requested = sortRequestedSlots(input.requestedSlots)
  const random = mulberry32(hashSeed(input.seed))
  const root = initialNode(input)
  let beam: SearchNode[] = [root]
  let best = root
  let expansionsUsed = 0
  let exhausted = false

  for (let slotIndex = 0; slotIndex < requested.length; slotIndex++) {
    if (exhausted) break
    const row = requested[slotIndex]
    const next: SearchNode[] = []
    for (const parent of beam) {
      if (exhausted) break
      const slotIssue = validateSlotForGeneration(row.slot, row.componentCount)
      if (slotIssue) {
        const child = withUnfilled(parent, row.slot, 'no-eligible-candidates')
        best = considerBest(best, child)
        next.push(child)
        continue
      }
      const ctx = scoringContext(input, row, parent)
      const eligible = enumerateCompositionCandidates(
        input,
        row.slot.mealType,
        row.slot.date,
      ).filter((candidate) => leftoverFitsRemaining(candidate, parent.remainingByEventId))
      if (eligible.length === 0) {
        const child = withUnfilled(parent, row.slot, 'no-eligible-candidates')
        best = considerBest(best, child)
        next.push(child)
        continue
      }
      const candidates = limitedCandidates(eligible, ctx, budget.perSlotCandidateLimit, random)
      let branched = false
      for (const candidate of candidates) {
        if (expansionsUsed >= budget.expansionBudget) {
          exhausted = true
          break
        }
        const assignment = assignmentFromCandidate(
          candidate,
          row.slot.id,
          row.slot.mealType,
          input.peopleCount,
          scale,
          input.quantityOverrides?.[row.slot.id],
          parent.remainingByEventId,
        )
        if (!assignment) continue
        if (
          assignment.components.some((component) =>
            component.type === 'recipe'
              ? !isValidPositiveQuantity(component.outputQuantity) ||
                !isValidPositiveQuantity(component.allocatedQuantity)
              : !isValidPositiveQuantity(component.allocatedQuantity),
          )
        ) {
          continue
        }
        expansionsUsed += 1
        branched = true
        const child = withAssignment(parent, row, candidate, assignment, eligible, ctx)
        best = considerBest(best, child)
        next.push(child)
        if (expansionsUsed >= budget.expansionBudget) {
          exhausted = true
          break
        }
      }
      if (!branched && !exhausted) {
        const child = withUnfilled(parent, row.slot, 'no-eligible-candidates')
        best = considerBest(best, child)
        next.push(child)
      }
    }
    if (next.length === 0) break
    beam = pruneBeam(next, budget.beamWidth)
    for (const node of beam) best = considerBest(best, node)
  }

  return finishProposal(input, requestId, best, requested, expansionsUsed)
}
