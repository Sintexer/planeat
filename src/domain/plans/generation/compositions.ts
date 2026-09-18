import type { RecipePairing } from '../../pairings/RecipePairing'
import type { Recipe } from '../../recipes/Recipe'
import type { MealType, RecipeRole } from '../../shared/MealEnums'
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

export type CompositionCandidate = {
  id: string
  source: SlotAssignmentSource
  parts: CompositionPart[]
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

export function enumerateCompositionCandidates(
  input: Pick<
    GenerationInput,
    'recipes' | 'simpleFoods' | 'favorites' | 'pairings' | 'policy' | 'compositionBounds'
  >,
  mealType: MealType,
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

  return out.sort(compareCandidates)
}

export function compositionStillEligible(
  assignment: SlotAssignment,
  input: GenerationInput,
  mealType: MealType,
): boolean {
  const candidates = enumerateCompositionCandidates(input, mealType)
  return candidates.some((candidate) => candidate.id === compositionIdFromAssignment(assignment))
}

export function compositionIdFromAssignment(assignment: SlotAssignment): string {
  if (assignment.source.type === 'favorite') return `favorite:${assignment.source.favoriteId}`
  if (assignment.source.type === 'pairing') return `pairing:${assignment.source.pairingId}`
  const first = assignment.components[0]
  if (first?.type === 'simple-food') return `standalone:food:${first.simpleFoodId}`
  if (first?.type === 'recipe') return `standalone:recipe:${first.recipeId}`
  return `standalone:unknown:${assignment.slotId}`
}

export function findCompositionCandidate(
  input: GenerationInput,
  mealType: MealType,
  assignment: SlotAssignment,
): CompositionCandidate | undefined {
  const id = compositionIdFromAssignment(assignment)
  return enumerateCompositionCandidates(input, mealType).find((row) => row.id === id)
}

export function recipesInComposition(candidate: CompositionCandidate): Recipe[] {
  return candidate.parts.flatMap((part) => (part.type === 'recipe' ? [part.recipe] : []))
}

export function foodsInComposition(candidate: CompositionCandidate): SimpleFood[] {
  return candidate.parts.flatMap((part) => (part.type === 'simple-food' ? [part.food] : []))
}

function validQuantity(quantity: Quantity | undefined | null): quantity is Quantity {
  return (
    !!quantity && Number.isFinite(quantity.value) && quantity.value > 0 && quantity.unit.length > 0
  )
}

export function assignmentFromCandidate(
  candidate: CompositionCandidate,
  slotId: string,
  mealType: MealType,
  peopleCount: number,
  scale: ScaleQuantity,
  override?: Quantity,
): SlotAssignment | undefined {
  const recipeParts = candidate.parts.filter((part) => part.type === 'recipe')
  const useOverride =
    override !== undefined && recipeParts.length === 1 && candidate.parts.length === 1
  const components: GeneratedComponent[] = []
  for (const part of candidate.parts) {
    if (part.type === 'recipe') {
      const quantity = useOverride
        ? override
        : (part.favoriteQuantity ?? scale(part.recipe.defaultPortionPerPerson, peopleCount))
      if (!validQuantity(quantity)) return undefined
      components.push({
        type: 'recipe',
        recipeId: part.recipe.id,
        recipeName: part.recipe.name,
        outputQuantity: quantity,
        allocatedQuantity: quantity,
        role: part.role ?? part.recipe.roles[0],
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
