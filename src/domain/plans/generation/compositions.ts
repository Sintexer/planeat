import type { RecipePairing } from '../../pairings/RecipePairing'
import type { Recipe } from '../../recipes/Recipe'
import type { MealType, RecipeRole } from '../../shared/MealEnums'
import { isReuseAllowed } from '../CookingEventAllocation'
import type { LocalDate } from '../../shared/LocalDate'
import type { Quantity } from '../../shared/Quantity'
import type { SimpleFood } from '../../simpleFoods/SimpleFood'
import { eligibleStandaloneRecipes } from './candidates'
import {
  compositionSatisfiesIncludes,
  DEFAULT_GENERATION_HARD_POLICY,
  recipeExcludeReasons,
  simpleFoodExcludeReasons,
  type GenerationHardPolicy,
} from './constraints'
import {
  mergeGenerationCompositionBounds,
  type GeneratedComponent,
  type GenerationCompositionBounds,
  type GenerationInput,
  type SlotAssignment,
  type SlotAssignmentSource,
} from './proposal'

export type ScaleQuantity = (quantity: Quantity | null, factor: number) => Quantity | null

export type CompositionPart =
  | { type: 'recipe'; recipe: Recipe; role?: RecipeRole; favoriteQuantity?: Quantity }
  | { type: 'simple-food'; food: SimpleFood; role?: RecipeRole; favoriteQuantity?: Quantity }
  | {
      type: 'leftover'
      eventId: string
      recipe: Recipe
      recipeName: string
      scheduledDate: LocalDate
      desiredQuantity: Quantity
      role?: RecipeRole
      proposed?: boolean
    }

export type CompositionCandidate = {
  id: string
  source: SlotAssignmentSource
  parts: CompositionPart[]
  extraUses?: number
  extraQuantity?: Quantity
  proposedEventId?: string
  /** Cooked recipe that receives extra output. Sides stay at one meal's portion. */
  batchRecipeId?: string
  /** Later requested slots this batch is sized to feed. */
  plannedConsumerSlotIds?: readonly string[]
}

function matchesOccasion(mealTypes: readonly MealType[], mealType: MealType): boolean {
  return mealTypes.includes(mealType)
}

function includePartsFromComposition(
  parts: readonly CompositionPart[],
): { tagIds: readonly string[]; linkedIngredientIds: readonly string[] }[] {
  return parts.map((part) => {
    if (part.type === 'recipe') {
      return {
        tagIds: part.recipe.tagIds,
        linkedIngredientIds: part.recipe.ingredientLines.flatMap((line) =>
          line.ingredientId !== undefined ? [line.ingredientId] : [],
        ),
      }
    }
    if (part.type === 'leftover') {
      return {
        tagIds: part.recipe.tagIds,
        linkedIngredientIds: part.recipe.ingredientLines.flatMap((line) =>
          line.ingredientId !== undefined ? [line.ingredientId] : [],
        ),
      }
    }
    return { tagIds: part.food.tagIds, linkedIngredientIds: [part.food.ingredientId] }
  })
}

function recipePartEligible(
  recipe: Recipe,
  mealType: MealType,
  policy: GenerationHardPolicy,
  requireComplete: boolean,
): boolean {
  if (requireComplete && !recipe.roles.includes('complete')) return false
  if (!matchesOccasion(recipe.mealTypes, mealType)) return false
  return recipeExcludeReasons(recipe, policy).length === 0
}

function foodPartEligible(
  food: SimpleFood,
  mealType: MealType,
  policy: GenerationHardPolicy,
  requireEnabled: boolean,
): boolean {
  if (requireEnabled && !food.enabledInSuggestions) return false
  if (!matchesOccasion(food.mealTypes, mealType)) return false
  return simpleFoodExcludeReasons(food, policy).length === 0
}

function compositionAllowed(
  parts: readonly CompositionPart[],
  policy: GenerationHardPolicy,
  bounds: GenerationCompositionBounds,
): boolean {
  if (parts.length === 0 || parts.length > bounds.maxComponentsPerCandidate) return false
  return compositionSatisfiesIncludes(includePartsFromComposition(parts), policy)
}

function compareCandidates(a: CompositionCandidate, b: CompositionCandidate): number {
  if (a.id < b.id) return -1
  if (a.id > b.id) return 1
  return 0
}

/** A main that is not also a complete dish needs a known side. Yield is unrelated. */
export function requiresAccompaniment(recipe: { roles: readonly RecipeRole[] }): boolean {
  return recipe.roles.includes('main') && !recipe.roles.includes('complete')
}

/** Stored pairings and favorite partners. Does not invent a side. */
export function knownAccompanimentParts(
  recipeId: string,
  input: Pick<
    GenerationInput,
    'recipes' | 'simpleFoods' | 'favorites' | 'pairings' | 'policy' | 'compositionBounds'
  >,
  mealType: MealType,
): CompositionPart[] {
  const policy = input.policy ?? DEFAULT_GENERATION_HARD_POLICY
  const bounds = mergeGenerationCompositionBounds(input.compositionBounds)
  const recipeById = new Map((input.recipes ?? []).map((recipe) => [recipe.id, recipe]))
  const foodById = new Map((input.simpleFoods ?? []).map((food) => [food.id, food]))
  const parts: CompositionPart[] = []
  const seen = new Set<string>()

  const add = (part: CompositionPart) => {
    if (parts.length >= bounds.maxPairingsPerRecipe) return
    const key =
      part.type === 'recipe'
        ? `recipe:${part.recipe.id}`
        : part.type === 'simple-food'
          ? `food:${part.food.id}`
          : `leftover:${part.eventId}`
    if (seen.has(key)) return
    seen.add(key)
    parts.push(part)
  }

  const pairings = [...(input.pairings ?? [])]
    .filter((pairing) => pairing.recipeId === recipeId)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  for (const pairing of pairings) {
    if (pairing.target.type === 'recipe') {
      const other = recipeById.get(pairing.target.id)
      if (!other || other.id === recipeId) continue
      if (!recipePartEligible(other, mealType, policy, false)) continue
      add({ type: 'recipe', recipe: other })
    } else {
      const food = foodById.get(pairing.target.id)
      if (!food || !foodPartEligible(food, mealType, policy, false)) continue
      add({ type: 'simple-food', food })
    }
  }

  for (const favorite of [...(input.favorites ?? [])].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  )) {
    const includesMain = favorite.components.some(
      (component) => component.type === 'recipe' && component.recipeId === recipeId,
    )
    if (!includesMain) continue
    for (const component of favorite.components) {
      if (component.type === 'recipe') {
        if (component.recipeId === recipeId) continue
        const other = recipeById.get(component.recipeId)
        if (!other || !recipePartEligible(other, mealType, policy, false)) continue
        add({
          type: 'recipe',
          recipe: other,
          role: component.role,
          favoriteQuantity: component.allocatedQuantity,
        })
      } else {
        const food = foodById.get(component.simpleFoodId)
        if (!food || !foodPartEligible(food, mealType, policy, false)) continue
        add({
          type: 'simple-food',
          food,
          role: component.role,
          favoriteQuantity: component.allocatedQuantity,
        })
      }
    }
  }

  return parts
}

export function enumerateCompositionCandidates(
  input: Pick<
    GenerationInput,
    | 'recipes'
    | 'simpleFoods'
    | 'favorites'
    | 'pairings'
    | 'policy'
    | 'compositionBounds'
    | 'cookingEvents'
  >,
  mealType: MealType,
  slotDate?: LocalDate,
): CompositionCandidate[] {
  const policy = input.policy ?? DEFAULT_GENERATION_HARD_POLICY
  const bounds = mergeGenerationCompositionBounds(input.compositionBounds)
  const recipes = input.recipes ?? []
  const foods = input.simpleFoods ?? []
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]))
  const foodById = new Map(foods.map((food) => [food.id, food]))
  const out: CompositionCandidate[] = []

  for (const recipe of eligibleStandaloneRecipes(recipes, mealType, policy)) {
    out.push({
      id: `standalone:recipe:${recipe.id}`,
      source: { type: 'standalone' },
      parts: [{ type: 'recipe', recipe }],
    })
  }

  for (const food of foods) {
    if (!foodPartEligible(food, mealType, policy, true)) continue
    if (!compositionAllowed([{ type: 'simple-food', food }], policy, bounds)) continue
    out.push({
      id: `standalone:food:${food.id}`,
      source: { type: 'standalone' },
      parts: [{ type: 'simple-food', food }],
    })
  }

  for (const favorite of input.favorites ?? []) {
    const parts: CompositionPart[] = []
    let valid = true
    for (const component of favorite.components) {
      if (component.type === 'recipe') {
        const recipe = recipeById.get(component.recipeId)
        if (!recipe || !recipePartEligible(recipe, mealType, policy, false)) {
          valid = false
          break
        }
        parts.push({
          type: 'recipe',
          recipe,
          role: component.role,
          favoriteQuantity: component.allocatedQuantity,
        })
      } else {
        const food = foodById.get(component.simpleFoodId)
        if (!food || !foodPartEligible(food, mealType, policy, false)) {
          valid = false
          break
        }
        parts.push({
          type: 'simple-food',
          food,
          role: component.role,
          favoriteQuantity: component.allocatedQuantity,
        })
      }
    }
    if (!valid || !compositionAllowed(parts, policy, bounds)) continue
    out.push({
      id: `favorite:${favorite.id}`,
      source: { type: 'favorite', favoriteId: favorite.id, favoriteName: favorite.name },
      parts,
    })
  }

  const pairingsByRecipe = new Map<string, RecipePairing[]>()
  for (const pairing of [...(input.pairings ?? [])].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  )) {
    const list = pairingsByRecipe.get(pairing.recipeId) ?? []
    if (list.length >= bounds.maxPairingsPerRecipe) continue
    list.push(pairing)
    pairingsByRecipe.set(pairing.recipeId, list)
  }

  for (const pairing of [...pairingsByRecipe.values()].flat()) {
    const base = recipeById.get(pairing.recipeId)
    if (!base || !recipePartEligible(base, mealType, policy, false)) continue
    const parts: CompositionPart[] = [{ type: 'recipe', recipe: base }]
    if (pairing.target.type === 'recipe') {
      const other = recipeById.get(pairing.target.id)
      if (!other || !recipePartEligible(other, mealType, policy, false)) continue
      parts.push({ type: 'recipe', recipe: other })
    } else {
      const food = foodById.get(pairing.target.id)
      if (!food || !foodPartEligible(food, mealType, policy, false)) continue
      parts.push({ type: 'simple-food', food })
    }
    if (!compositionAllowed(parts, policy, bounds)) continue
    out.push({
      id: `pairing:${pairing.id}`,
      source: { type: 'pairing', pairingId: pairing.id },
      parts,
    })
  }

  if (slotDate !== undefined) {
    for (const event of input.cookingEvents ?? []) {
      if (!event.desiredQuantity || event.remaining.value <= 0) continue
      if (!matchesOccasion(event.mealTypes, mealType)) continue
      if (!isReuseAllowed(event.reusePolicy, event.scheduledDate, slotDate)) continue
      if (recipeExcludeReasons(event.recipe, policy).length > 0) continue
      const leftoverPart: CompositionPart = {
        type: 'leftover',
        eventId: event.id,
        recipe: event.recipe,
        recipeName: event.recipeName,
        scheduledDate: event.scheduledDate,
        desiredQuantity: event.desiredQuantity,
        role: event.role ?? event.recipe.roles[0],
        proposed: event.proposed,
      }
      const needsSide = requiresAccompaniment(event.recipe)
      if (!needsSide && compositionAllowed([leftoverPart], policy, bounds)) {
        out.push({
          id: `leftover:${event.id}`,
          source: { type: 'leftover', cookingEventId: event.id },
          parts: [leftoverPart],
        })
      }
      for (const side of knownAccompanimentParts(event.recipeId, input, mealType)) {
        const parts = [leftoverPart, side]
        if (!compositionAllowed(parts, policy, bounds)) continue
        const sideKey =
          side.type === 'recipe'
            ? side.recipe.id
            : side.type === 'simple-food'
              ? side.food.id
              : side.eventId
        out.push({
          id: `leftover:${event.id}:with:${sideKey}`,
          source: { type: 'leftover', cookingEventId: event.id },
          parts,
        })
      }
    }
  }

  return out.sort(compareCandidates)
}

export function compositionStillEligible(
  assignment: SlotAssignment,
  input: GenerationInput,
  mealType: MealType,
  slotDate: LocalDate,
): boolean {
  const first = assignment.components[0]
  if (first?.type === 'leftover' && first.proposedEventId) {
    const recipe = input.recipes.find((row) => row.id === first.recipeId)
    if (!recipe) return false
    if (!matchesOccasion(recipe.mealTypes, mealType)) return false
    return isReuseAllowed(recipe.reusePolicy, first.scheduledDate, slotDate)
  }
  const candidates = enumerateCompositionCandidates(input, mealType, slotDate)
  const id = compositionIdFromAssignment(assignment)
  return candidates.some((candidate) => candidate.id === id)
}

export function compositionIdFromAssignment(assignment: SlotAssignment): string {
  if (assignment.source.type === 'favorite') return `favorite:${assignment.source.favoriteId}`
  if (assignment.source.type === 'pairing') return `pairing:${assignment.source.pairingId}`
  if (assignment.source.type === 'leftover') {
    const leftover = assignment.components.find((component) => component.type === 'leftover')
    if (leftover?.type === 'leftover' && leftover.proposedEventId) {
      return `leftover:${leftover.proposedEventId}`
    }
    return `leftover:${assignment.source.cookingEventId}`
  }
  const first = assignment.components[0]
  if (first?.type === 'simple-food') return `standalone:food:${first.simpleFoodId}`
  if (first?.type === 'recipe') return `standalone:recipe:${first.recipeId}`
  if (first?.type === 'leftover') {
    return `leftover:${first.proposedEventId ?? first.cookingEventId}`
  }
  return `standalone:unknown:${assignment.slotId}`
}

export function findCompositionCandidate(
  input: GenerationInput,
  mealType: MealType,
  assignment: SlotAssignment,
  slotDate: LocalDate,
): CompositionCandidate | undefined {
  const id = compositionIdFromAssignment(assignment)
  return enumerateCompositionCandidates(input, mealType, slotDate).find((row) => row.id === id)
}

export function recipesInComposition(candidate: CompositionCandidate): Recipe[] {
  return candidate.parts.flatMap((part) => (part.type === 'recipe' ? [part.recipe] : []))
}

export function leftoverRecipesInComposition(candidate: CompositionCandidate): Recipe[] {
  return candidate.parts.flatMap((part) => (part.type === 'leftover' ? [part.recipe] : []))
}

export function foodsInComposition(candidate: CompositionCandidate): SimpleFood[] {
  return candidate.parts.flatMap((part) => (part.type === 'simple-food' ? [part.food] : []))
}

function validQuantity(quantity: Quantity | undefined | null): quantity is Quantity {
  return (
    !!quantity && Number.isFinite(quantity.value) && quantity.value > 0 && quantity.unit.length > 0
  )
}

function overrideForPart(
  candidate: CompositionCandidate,
  part: CompositionPart,
  override: Quantity | undefined,
  unit: string | undefined,
): Quantity | undefined {
  if (!override || !unit || override.unit !== unit || !(override.value > 0)) return undefined
  if (candidate.parts.length === 1) return override
  if (part.type === 'recipe' && candidate.batchRecipeId === part.recipe.id) return override
  if (part.type === 'leftover') return override
  return undefined
}

export function assignmentFromCandidate(
  candidate: CompositionCandidate,
  slotId: string,
  mealType: MealType,
  peopleCount: number,
  scale: ScaleQuantity,
  override?: Quantity,
  remainingByEventId?: ReadonlyMap<string, Quantity>,
): SlotAssignment | undefined {
  const components: GeneratedComponent[] = []
  for (const part of candidate.parts) {
    if (part.type === 'recipe') {
      const scaled =
        part.favoriteQuantity ?? scale(part.recipe.defaultPortionPerPerson, peopleCount)
      const quantity = overrideForPart(candidate, part, override, scaled?.unit) ?? scaled
      if (!validQuantity(quantity)) return undefined
      const extra = candidate.extraQuantity
      const receivesExtra =
        !!extra &&
        extra.unit === quantity.unit &&
        (candidate.batchRecipeId !== undefined
          ? candidate.batchRecipeId === part.recipe.id
          : candidate.parts.filter((item) => item.type === 'recipe').length === 1)
      const outputQuantity = receivesExtra
        ? { value: quantity.value + extra.value, unit: quantity.unit }
        : quantity
      if (!validQuantity(outputQuantity)) return undefined
      components.push({
        type: 'recipe',
        recipeId: part.recipe.id,
        recipeName: part.recipe.name,
        outputQuantity,
        allocatedQuantity: quantity,
        role: part.role ?? part.recipe.roles[0],
        proposedEventId: receivesExtra ? candidate.proposedEventId : undefined,
      })
    } else if (part.type === 'leftover') {
      const remaining = remainingByEventId?.get(part.eventId)
      if (!validQuantity(remaining)) return undefined
      const scaled = scale(part.recipe.defaultPortionPerPerson, peopleCount)
      let desired = scaled && scaled.unit === remaining.unit ? scaled : part.desiredQuantity
      const slotOverride = overrideForPart(candidate, part, override, remaining.unit)
      if (slotOverride) desired = slotOverride
      if (desired.unit !== remaining.unit) return undefined
      const allocated = {
        value: Math.min(desired.value, remaining.value),
        unit: remaining.unit,
      }
      if (!validQuantity(allocated)) return undefined
      components.push({
        type: 'leftover',
        cookingEventId: part.eventId,
        recipeId: part.recipe.id,
        recipeName: part.recipeName,
        scheduledDate: part.scheduledDate,
        allocatedQuantity: allocated,
        role: part.role ?? part.recipe.roles[0],
        proposedEventId: part.proposed ? part.eventId : undefined,
      })
    } else {
      const quantity = part.favoriteQuantity ?? scale(part.food.defaultPortion, peopleCount)
      if (!validQuantity(quantity)) return undefined
      components.push({
        type: 'simple-food',
        simpleFoodId: part.food.id,
        name: part.food.name,
        allocatedQuantity: quantity,
        role: part.role ?? part.food.roles[0],
      })
    }
  }
  if (components.length === 0) return undefined
  return {
    slotId,
    mealType,
    source: candidate.source,
    components,
    scoreReasons: [],
  }
}
