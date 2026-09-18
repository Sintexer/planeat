import type { Recipe } from '../../recipes/Recipe'
import type { SimpleFood } from '../../simpleFoods/SimpleFood'
import type { MealType } from '../../shared/MealEnums'
import type { CookingEvent } from '../CookingEvent'
import type { MealComponent } from '../MealComponent'
import type { MealSlot } from '../MealSlot'

export type UnknownDataPolicy = 'exclude' | 'allow'

export type ConstraintReason =
  | 'not-complete'
  | 'occasion'
  | 'excluded-recipe'
  | 'required-tags'
  | 'excluded-tags'
  | 'include-ingredients'
  | 'exclude-ingredients'
  | 'max-total-time'
  | 'unknown-time'
  | 'unknown-ingredients'

export type GenerationHardPolicy = {
  unknownTimePolicy: UnknownDataPolicy
  unknownIngredientPolicy: UnknownDataPolicy
  excludedRecipeIds: readonly string[]
  requiredTagIds: readonly string[]
  excludedTagIds: readonly string[]
  includeIngredientIds: readonly string[]
  excludeIngredientIds: readonly string[]
  maxTotalTimeMinutes?: number
}

export const DEFAULT_GENERATION_HARD_POLICY: GenerationHardPolicy = {
  unknownTimePolicy: 'exclude',
  unknownIngredientPolicy: 'exclude',
  excludedRecipeIds: [],
  requiredTagIds: [],
  excludedTagIds: [],
  includeIngredientIds: [],
  excludeIngredientIds: [],
}

export type FixedMeal = {
  slotId: string
  date: string
  mealType: MealType
  recipeId?: string
  recipe?: Recipe
  simpleFood?: { id: string; ingredientId: string; tagIds: readonly string[] }
}

export type MissingPolicyRefs = {
  recipeIds: string[]
  tagIds: string[]
  ingredientIds: string[]
}

export type FacetDropCount = {
  mealType: MealType
  reason: ConstraintReason
  count: number
}

export type FixedMealConflict = {
  slotId: string
  date: string
  mealType: MealType
  reasons: ConstraintReason[]
}

export type GenerationDiagnostics = {
  dropCounts: FacetDropCount[]
  fixedConflicts: FixedMealConflict[]
  missingPolicyRefs: MissingPolicyRefs
}

const UNKNOWN_POLICIES = new Set<UnknownDataPolicy>(['exclude', 'allow'])

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

function parseUnknownPolicy(value: unknown, fallback: UnknownDataPolicy): UnknownDataPolicy {
  return typeof value === 'string' && UNKNOWN_POLICIES.has(value as UnknownDataPolicy)
    ? (value as UnknownDataPolicy)
    : fallback
}

function parseMaxTotalTime(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function sortIds(ids: readonly string[]): string[] {
  return [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

export function mergeGenerationHardPolicy(
  row?: Partial<GenerationHardPolicy> | null,
): GenerationHardPolicy {
  const maxTotalTimeMinutes = parseMaxTotalTime(row?.maxTotalTimeMinutes)
  return {
    unknownTimePolicy: parseUnknownPolicy(
      row?.unknownTimePolicy,
      DEFAULT_GENERATION_HARD_POLICY.unknownTimePolicy,
    ),
    unknownIngredientPolicy: parseUnknownPolicy(
      row?.unknownIngredientPolicy,
      DEFAULT_GENERATION_HARD_POLICY.unknownIngredientPolicy,
    ),
    excludedRecipeIds: asStringArray(row?.excludedRecipeIds),
    requiredTagIds: asStringArray(row?.requiredTagIds),
    excludedTagIds: asStringArray(row?.excludedTagIds),
    includeIngredientIds: asStringArray(row?.includeIngredientIds),
    excludeIngredientIds: asStringArray(row?.excludeIngredientIds),
    ...(maxTotalTimeMinutes !== undefined ? { maxTotalTimeMinutes } : {}),
  }
}

export function canonicalizeGenerationHardPolicy(
  policy: GenerationHardPolicy,
): GenerationHardPolicy {
  const merged = mergeGenerationHardPolicy(policy)
  return {
    ...merged,
    excludedRecipeIds: sortIds(merged.excludedRecipeIds),
    requiredTagIds: sortIds(merged.requiredTagIds),
    excludedTagIds: sortIds(merged.excludedTagIds),
    includeIngredientIds: sortIds(merged.includeIngredientIds),
    excludeIngredientIds: sortIds(merged.excludeIngredientIds),
  }
}

export function missingGenerationPolicyRefs(
  policy: GenerationHardPolicy,
  catalogs: {
    recipeIds: Iterable<string>
    tagIds: Iterable<string>
    ingredientIds: Iterable<string>
  },
): MissingPolicyRefs {
  const recipes = new Set(catalogs.recipeIds)
  const tags = new Set(catalogs.tagIds)
  const ingredients = new Set(catalogs.ingredientIds)
  return {
    recipeIds: policy.excludedRecipeIds.filter((id) => !recipes.has(id)),
    tagIds: [...policy.requiredTagIds, ...policy.excludedTagIds].filter(
      (id, index, all) => all.indexOf(id) === index && !tags.has(id),
    ),
    ingredientIds: [...policy.includeIngredientIds, ...policy.excludeIngredientIds].filter(
      (id, index, all) => all.indexOf(id) === index && !ingredients.has(id),
    ),
  }
}

function linkedIngredientIds(recipe: Recipe): string[] {
  return recipe.ingredientLines.flatMap((line) =>
    line.ingredientId !== undefined ? [line.ingredientId] : [],
  )
}

function hasUnlinkedIngredientLine(recipe: Recipe): boolean {
  return recipe.ingredientLines.some((line) => line.ingredientId === undefined)
}

function ingredientFacetsActive(policy: GenerationHardPolicy): boolean {
  return policy.includeIngredientIds.length > 0 || policy.excludeIngredientIds.length > 0
}

export function restrictionReasonsForRecipe(
  recipe: Recipe,
  policy: GenerationHardPolicy,
): ConstraintReason[] {
  const reasons: ConstraintReason[] = []
  if (policy.excludedRecipeIds.includes(recipe.id)) reasons.push('excluded-recipe')
  if (
    policy.requiredTagIds.length > 0 &&
    !policy.requiredTagIds.some((id) => recipe.tagIds.includes(id))
  ) {
    reasons.push('required-tags')
  }
  if (policy.excludedTagIds.some((id) => recipe.tagIds.includes(id))) {
    reasons.push('excluded-tags')
  }

  const linked = linkedIngredientIds(recipe)
  const unknownIngredients =
    ingredientFacetsActive(policy) &&
    hasUnlinkedIngredientLine(recipe) &&
    policy.unknownIngredientPolicy === 'exclude'
  if (unknownIngredients) reasons.push('unknown-ingredients')

  if (
    policy.includeIngredientIds.length > 0 &&
    !policy.includeIngredientIds.some((id) => linked.includes(id))
  ) {
    reasons.push('include-ingredients')
  }
  if (policy.excludeIngredientIds.some((id) => linked.includes(id))) {
    reasons.push('exclude-ingredients')
  }

  if (policy.maxTotalTimeMinutes !== undefined) {
    if (recipe.totalTimeMinutes === undefined) {
      if (policy.unknownTimePolicy === 'exclude') reasons.push('unknown-time')
    } else if (recipe.totalTimeMinutes > policy.maxTotalTimeMinutes) {
      reasons.push('max-total-time')
    }
  }

  return reasons
}

export function restrictionReasonsForSimpleFood(
  food: { ingredientId: string; tagIds: readonly string[] },
  policy: GenerationHardPolicy,
): ConstraintReason[] {
  const reasons: ConstraintReason[] = []
  if (
    policy.requiredTagIds.length > 0 &&
    !policy.requiredTagIds.some((id) => food.tagIds.includes(id))
  ) {
    reasons.push('required-tags')
  }
  if (policy.excludedTagIds.some((id) => food.tagIds.includes(id))) {
    reasons.push('excluded-tags')
  }
  if (
    policy.includeIngredientIds.length > 0 &&
    !policy.includeIngredientIds.includes(food.ingredientId)
  ) {
    reasons.push('include-ingredients')
  }
  if (policy.excludeIngredientIds.includes(food.ingredientId)) {
    reasons.push('exclude-ingredients')
  }
  return reasons
}

export function candidateConstraintReasons(
  recipe: Recipe,
  mealType: MealType,
  policy: GenerationHardPolicy,
): ConstraintReason[] {
  const reasons: ConstraintReason[] = []
  if (!recipe.roles.includes('complete')) reasons.push('not-complete')
  if (!recipe.mealTypes.includes(mealType)) reasons.push('occasion')
  reasons.push(...restrictionReasonsForRecipe(recipe, policy))
  return reasons
}

export function recipeSatisfiesHardPolicy(
  recipe: Recipe,
  mealType: MealType,
  policy: GenerationHardPolicy,
): boolean {
  return candidateConstraintReasons(recipe, mealType, policy).length === 0
}

export function fixedMealRestrictionReasons(
  meal: FixedMeal,
  policy: GenerationHardPolicy,
): ConstraintReason[] {
  if (meal.recipe) return restrictionReasonsForRecipe(meal.recipe, policy)
  if (meal.recipeId !== undefined) {
    return policy.excludedRecipeIds.includes(meal.recipeId) ? ['excluded-recipe'] : []
  }
  if (meal.simpleFood) return restrictionReasonsForSimpleFood(meal.simpleFood, policy)
  return []
}

export function fixedMealsFromPlan(args: {
  slots: readonly MealSlot[]
  components: readonly MealComponent[]
  cookingEvents: readonly CookingEvent[]
  recipes: readonly Recipe[]
  simpleFoods: readonly SimpleFood[]
}): FixedMeal[] {
  const recipesById = new Map(args.recipes.map((recipe) => [recipe.id, recipe]))
  const foodsById = new Map(args.simpleFoods.map((food) => [food.id, food]))
  const eventsById = new Map(args.cookingEvents.map((event) => [event.id, event]))
  const slotsById = new Map(args.slots.map((slot) => [slot.id, slot]))
  const filled = new Map<string, FixedMeal>()

  for (const component of args.components) {
    const slot = slotsById.get(component.slotId)
    if (!slot || slot.excluded) continue
    const existing = filled.get(slot.id) ?? {
      slotId: slot.id,
      date: slot.date,
      mealType: slot.mealType,
    }

    if (component.source.type === 'cooking-event') {
      const event = eventsById.get(component.source.cookingEventId)
      if (!event) {
        filled.set(slot.id, existing)
        continue
      }
      filled.set(slot.id, {
        ...existing,
        recipeId: event.recipeId,
        recipe: recipesById.get(event.recipeId),
      })
      continue
    }

    const food = foodsById.get(component.source.simpleFoodId)
    filled.set(slot.id, {
      ...existing,
      simpleFood: food
        ? { id: food.id, ingredientId: food.ingredientId, tagIds: food.tagIds }
        : existing.simpleFood,
    })
  }

  return [...filled.values()]
}

export function buildGenerationDiagnostics(
  recipes: readonly Recipe[],
  mealTypes: readonly MealType[],
  policy: GenerationHardPolicy,
  fixedMeals: readonly FixedMeal[],
  catalogs: {
    recipeIds: Iterable<string>
    tagIds: Iterable<string>
    ingredientIds: Iterable<string>
  },
): GenerationDiagnostics {
  const dropCounts: FacetDropCount[] = []
  const uniqueMealTypes = [...new Set(mealTypes)]
  for (const mealType of uniqueMealTypes) {
    const tallies = new Map<ConstraintReason, number>()
    for (const recipe of recipes) {
      for (const reason of candidateConstraintReasons(recipe, mealType, policy)) {
        tallies.set(reason, (tallies.get(reason) ?? 0) + 1)
      }
    }
    for (const [reason, count] of tallies) {
      if (count > 0) dropCounts.push({ mealType, reason, count })
    }
  }

  const fixedConflicts: FixedMealConflict[] = []
  for (const meal of fixedMeals) {
    const reasons = fixedMealRestrictionReasons(meal, policy)
    if (reasons.length === 0) continue
    fixedConflicts.push({
      slotId: meal.slotId,
      date: meal.date,
      mealType: meal.mealType,
      reasons,
    })
  }

  return {
    dropCounts,
    fixedConflicts,
    missingPolicyRefs: missingGenerationPolicyRefs(policy, catalogs),
  }
}
