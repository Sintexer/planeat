import type { MealFavorite } from '../../domain/favorites/MealFavorite'
import type { RecipePairing } from '../../domain/pairings/RecipePairing'
import type { SuggestionCandidate } from '../../domain/plans/componentSuggestions'
import type { PlanGraph } from '../../domain/plans/PlanGraph'
import { WEEKDAY_LABELS, weekdayOf, type LocalDate } from '../../domain/shared/LocalDate'

export function leftoverBatchSubtitle(scheduledDate: LocalDate): string {
  return `Uses ${WEEKDAY_LABELS[weekdayOf(scheduledDate)]}'s batch`
}

export function pickerWhyThisCopy(args: {
  kind: 'recipe' | 'simple-food'
  reason: SuggestionCandidate['reason']
  pairingPartnerName?: string
  favoriteName?: string
  plannedThisWeek?: boolean
}): string {
  if (args.reason === 'pairing') {
    return args.pairingPartnerName
      ? `Often paired with ${args.pairingPartnerName}`
      : 'Often paired together'
  }
  if (args.reason === 'favorite') {
    return args.favoriteName ? `From favorite ${args.favoriteName}` : 'From a favorite'
  }
  if (args.plannedThisWeek) {
    return 'Already planned this week'
  }
  return args.kind === 'recipe' ? 'Recipe' : 'Simple food'
}

export function pairingPartnerName(args: {
  candidateKind: 'recipe' | 'simple-food'
  candidateId: string
  currentRecipeIds: Set<string>
  pairings: RecipePairing[]
  recipeNamesById: Map<string, string>
}): string | undefined {
  const names: string[] = []
  for (const pairing of args.pairings) {
    const recipeIsCurrent = args.currentRecipeIds.has(pairing.recipeId)
    const targetIsCurrent =
      pairing.target.type === 'recipe' && args.currentRecipeIds.has(pairing.target.id)
    const candidateIsRecipeSide =
      args.candidateKind === 'recipe' && pairing.recipeId === args.candidateId
    const candidateIsTarget =
      pairing.target.type === args.candidateKind && pairing.target.id === args.candidateId

    if (recipeIsCurrent && candidateIsTarget) {
      const name = args.recipeNamesById.get(pairing.recipeId)
      if (name) names.push(name)
    }
    if (targetIsCurrent && candidateIsRecipeSide) {
      const name = args.recipeNamesById.get(pairing.target.id)
      if (name) names.push(name)
    }
  }
  names.sort((a, b) => a.localeCompare(b))
  return names[0]
}

export function matchingFavoriteName(args: {
  candidateKind: 'recipe' | 'simple-food'
  candidateId: string
  currentRecipeIds: Set<string>
  favorites: MealFavorite[]
}): string | undefined {
  for (const favorite of args.favorites) {
    const hasCurrent = favorite.components.some(
      (component) => component.type === 'recipe' && args.currentRecipeIds.has(component.recipeId),
    )
    if (!hasCurrent) continue
    const hasCandidate = favorite.components.some((component) =>
      args.candidateKind === 'recipe'
        ? component.type === 'recipe' && component.recipeId === args.candidateId
        : component.type === 'simple-food' && component.simpleFoodId === args.candidateId,
    )
    if (hasCandidate) return favorite.name
  }
  return undefined
}

export function isPlannedThisWeek(
  kind: 'recipe' | 'simple-food',
  id: string,
  graph: PlanGraph,
): boolean {
  if (kind === 'recipe') {
    return graph.cookingEvents.some((event) => event.recipeId === id)
  }
  return graph.components.some(
    (component) => component.source.type === 'simple-food' && component.source.simpleFoodId === id,
  )
}
