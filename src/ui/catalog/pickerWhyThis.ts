import type { Translate } from '../localization/t'
import { kindLabel } from '../localization/labels'
import type { MealFavorite } from '../../domain/favorites/MealFavorite'
import type { RecipePairing } from '../../domain/pairings/RecipePairing'
import type { SuggestionCandidate } from '../../domain/plans/componentSuggestions'
import type { PlanGraph } from '../../domain/plans/PlanGraph'
import type { CookingEvent } from '../../domain/plans/CookingEvent'
import type { LocalDate } from '../../domain/shared/LocalDate'
import { weekdayOf, type WeekStartDay } from '../../domain/shared/LocalDate'

export type WhyThisCopy =
  | { type: 'pairing'; partner?: string }
  | { type: 'favorite'; name?: string }
  | { type: 'planned' }
  | { type: 'kind'; kind: 'recipe' | 'simple-food' }

export function leftoverBatchWeekday(scheduledDate: LocalDate): WeekStartDay {
  return weekdayOf(scheduledDate)
}

export function pickerWhyThisCopy(args: {
  kind: 'recipe' | 'simple-food'
  reason: SuggestionCandidate['reason']
  pairingPartnerName?: string
  favoriteName?: string
  plannedThisWeek?: boolean
}): WhyThisCopy {
  if (args.reason === 'pairing') {
    return { type: 'pairing', partner: args.pairingPartnerName }
  }
  if (args.reason === 'favorite') {
    return { type: 'favorite', name: args.favoriteName }
  }
  if (args.plannedThisWeek) {
    return { type: 'planned' }
  }
  return { type: 'kind', kind: args.kind }
}

export type ReasonBadgeCopy = { type: 'pairing' | 'favorite'; label: string }

/** Surfaces the two "smart suggestion" reasons as a short badge, distinct
 * from the generic subtitle prose that {@link formatWhyThis} produces. */
export function reasonBadgeCopy(
  t: Translate,
  reason?: SuggestionCandidate['reason'],
): ReasonBadgeCopy | undefined {
  if (reason === 'pairing') return { type: 'pairing', label: t('picker.pairedBadge') }
  if (reason === 'favorite') return { type: 'favorite', label: t('picker.favoriteBadge') }
  return undefined
}

export function formatWhyThis(t: Translate, copy: WhyThisCopy): string {
  if (copy.type === 'pairing') {
    return copy.partner
      ? t('picker.pairedWith', { name: copy.partner })
      : t('picker.pairedTogether')
  }
  if (copy.type === 'favorite') {
    return copy.name ? t('picker.fromFavoriteNamed', { name: copy.name }) : t('picker.fromFavorite')
  }
  if (copy.type === 'planned') return t('picker.alreadyPlanned')
  return kindLabel(t, copy.kind)
}

export function pairingPartnerName(args: {
  candidateKind: 'recipe' | 'simple-food'
  candidateId: string
  currentRecipeIds: Set<string>
  pairings: RecipePairing[]
  recipeNamesById: Map<string, string>
  locale?: string
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
  names.sort((a, b) => a.localeCompare(b, args.locale))
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
    return graph.cookingEvents.some((event: CookingEvent) => event.recipeId === id)
  }
  return graph.components.some(
    (component) => component.source.type === 'simple-food' && component.source.simpleFoodId === id,
  )
}
