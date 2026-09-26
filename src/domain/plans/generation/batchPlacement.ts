import type { Recipe } from '../../recipes/Recipe'
import type { RecipeRole } from '../../shared/MealEnums'
import { daysBetween, weekdayOf, type LocalDate } from '../../shared/LocalDate'
import type { Quantity } from '../../shared/Quantity'
import { isReuseAllowed } from '../CookingEventAllocation'
import {
  knownAccompanimentParts,
  requiresAccompaniment,
  type CompositionCandidate,
  type CompositionPart,
  type ScaleQuantity,
} from './compositions'
import {
  mergeGenerationBatchPolicy,
  type GenerationInput,
  type RequestedGenerationSlot,
} from './proposal'
import { DEFAULT_GENERATION_SOFT_PREFS, type GenerationSoftPrefs } from './scoring'

/**
 * Portion for one meal. Recipe yield scales groceries; it is not a minimum batch.
 * Returns null when the slot override uses a different unit.
 */
export function mealPortion(
  recipe: Recipe,
  slotId: string,
  peopleCount: number,
  scale: ScaleQuantity,
  overrides?: Readonly<Record<string, Quantity>>,
): Quantity | null {
  const scaled = scale(recipe.defaultPortionPerPerson, peopleCount)
  if (!scaled || !(scaled.value > 0) || scaled.unit.length === 0) return null
  const override = overrides?.[slotId]
  if (!override) return scaled
  if (override.unit !== scaled.unit || !(override.value > 0)) return null
  return { value: override.value, unit: override.unit }
}

export function isBusyDay(date: LocalDate, prefs: GenerationSoftPrefs): boolean {
  return prefs.quickMealsOnlyDays.includes(weekdayOf(date))
}

/** Free days, or a preferred prep day when the household named some. */
export function shouldOfferBatchVariants(
  date: LocalDate,
  laterDates: readonly LocalDate[],
  prefs: GenerationSoftPrefs,
): boolean {
  if (isBusyDay(date, prefs)) {
    return !laterDates.some((later) => !isBusyDay(later, prefs))
  }
  const preferred = prefs.preferredBatchPrepDays
  if (preferred.length === 0) return true
  if (preferred.includes(weekdayOf(date))) return true
  const laterPreferred = laterDates.some(
    (later) => preferred.includes(weekdayOf(later)) && !isBusyDay(later, prefs),
  )
  return !laterPreferred
}

export function accompanimentFits(
  part: CompositionPart,
  date: LocalDate,
  prefs: GenerationSoftPrefs,
  demandingAlready: number,
): boolean {
  if (part.type !== 'recipe') return true
  if (isBusyDay(date, prefs) && part.recipe.effort !== 'quick') return false
  if (
    prefs.avoidMultipleDemandingPreps &&
    part.recipe.effort === 'demanding' &&
    demandingAlready >= 1
  ) {
    return false
  }
  return true
}

/** Drop leftover plates whose new side would hide real cooking on a restricted day. */
export function filterPrepRestrictedCandidates(
  candidates: readonly CompositionCandidate[],
  date: LocalDate,
  prefs: GenerationSoftPrefs,
  demandingAlready: number,
): CompositionCandidate[] {
  return candidates.filter((candidate) => {
    const hasLeftover = candidate.parts.some((part) => part.type === 'leftover')
    if (!hasLeftover) return true
    return candidate.parts.every((part) => accompanimentFits(part, date, prefs, demandingAlready))
  })
}

function isBatchMain(recipe: Recipe, role?: RecipeRole): boolean {
  const roles = role ? [role, ...recipe.roles] : recipe.roles
  if (roles.includes('side') && !roles.includes('main') && !roles.includes('complete')) return false
  return roles.includes('main') || roles.includes('complete')
}

function batchMainPart(
  candidate: CompositionCandidate,
): Extract<CompositionPart, { type: 'recipe' }> | undefined {
  const mains = candidate.parts.filter(
    (part): part is Extract<CompositionPart, { type: 'recipe' }> =>
      part.type === 'recipe' && isBatchMain(part.recipe, part.role),
  )
  if (mains.length !== 1) return undefined
  return mains[0]
}

type ConsumerChoice = {
  key: string
  slots: RequestedGenerationSlot[]
  portions: Quantity[]
}

function consumerPlans(
  choices: readonly { row: RequestedGenerationSlot; portion: Quantity }[],
  prep: RequestedGenerationSlot,
  maxExtra: number,
): ConsumerChoice[] {
  if (choices.length === 0 || maxExtra <= 0) return []
  const sorted = [...choices].sort((a, b) => {
    if (a.row.slot.date !== b.row.slot.date) return a.row.slot.date < b.row.slot.date ? -1 : 1
    const meal = mealOrder(a.row.slot.mealType) - mealOrder(b.row.slot.mealType)
    if (meal !== 0) return meal
    return a.row.slot.id < b.row.slot.id ? -1 : a.row.slot.id > b.row.slot.id ? 1 : 0
  })
  const earliest = sorted[0]
  const spaced = sorted.find((choice) => daysBetween(prep.slot.date, choice.row.slot.date) >= 2)
  const otherOccasion = sorted.find((choice) => choice.row.slot.mealType !== prep.slot.mealType)
  const plans: ConsumerChoice[] = []
  const add = (items: { row: RequestedGenerationSlot; portion: Quantity }[]) => {
    if (items.length === 0 || items.length > maxExtra) return
    const unit = items[0]?.portion.unit
    if (!unit || items.some((item) => item.portion.unit !== unit)) return
    const key = items.map((item) => item.row.slot.id).join('+')
    if (plans.some((plan) => plan.key === key)) return
    plans.push({
      key,
      slots: items.map((item) => item.row),
      portions: items.map((item) => item.portion),
    })
  }
  if (earliest) add([earliest])
  if (spaced) add([spaced])
  if (otherOccasion) add([otherOccasion])
  if (maxExtra >= 2 && earliest) {
    const second = spaced && spaced.row.slot.id !== earliest.row.slot.id ? spaced : sorted[1]
    if (second && second.row.slot.id !== earliest.row.slot.id) add([earliest, second])
  }
  return plans.slice(0, 4)
}

function mealOrder(mealType: RequestedGenerationSlot['slot']['mealType']): number {
  if (mealType === 'breakfast') return 0
  if (mealType === 'lunch') return 1
  return 2
}

/**
 * This-meal candidate plus a few concrete later-use sizes.
 * Production is the sum of those meals' portions, never the recipe yield.
 */
export function expandBatchPlacements(
  enumerated: readonly CompositionCandidate[],
  input: GenerationInput,
  row: RequestedGenerationSlot,
  laterRows: readonly RequestedGenerationSlot[],
  scale: ScaleQuantity,
  reservedSlotIds: ReadonlySet<string>,
  demandingByDate: ReadonlyMap<string, number>,
): CompositionCandidate[] {
  const policy = mergeGenerationBatchPolicy(input.batchPolicy)
  const prefs = input.softPrefs ?? DEFAULT_GENERATION_SOFT_PREFS
  const offer =
    policy.maxExtraPlannedUses > 0 &&
    shouldOfferBatchVariants(
      row.slot.date,
      laterRows.map((later) => later.slot.date),
      prefs,
    )
  const out: CompositionCandidate[] = []
  for (const candidate of enumerated) {
    out.push(candidate)
    if (!offer) continue
    const mainPart = batchMainPart(candidate)
    if (!mainPart) continue
    const main = mainPart.recipe
    if (
      main.reusePolicy === 'fresh-only' &&
      !laterRows.some((later) => later.slot.date === row.slot.date)
    ) {
      continue
    }
    const prepPortion = mealPortion(
      main,
      row.slot.id,
      input.peopleCount,
      scale,
      input.quantityOverrides,
    )
    if (!prepPortion) continue
    if (requiresAccompaniment(main)) {
      const hasSide = candidate.parts.some((part) => part !== mainPart && part.type !== 'leftover')
      if (!hasSide) continue
    }
    const choices: { row: RequestedGenerationSlot; portion: Quantity }[] = []
    for (const later of laterRows) {
      if (reservedSlotIds.has(later.slot.id)) continue
      if (!main.mealTypes.includes(later.slot.mealType)) continue
      if (!isReuseAllowed(main.reusePolicy, row.slot.date, later.slot.date)) continue
      const portion = mealPortion(
        main,
        later.slot.id,
        input.peopleCount,
        scale,
        input.quantityOverrides,
      )
      if (!portion || portion.unit !== prepPortion.unit) continue
      if (requiresAccompaniment(main)) {
        const demanding = demandingByDate.get(later.slot.date) ?? 0
        const sides = knownAccompanimentParts(main.id, input, later.slot.mealType)
        const fits = sides.some((side) =>
          accompanimentFits(side, later.slot.date, prefs, demanding),
        )
        if (!fits) continue
      }
      choices.push({ row: later, portion })
    }
    for (const plan of consumerPlans(choices, row, policy.maxExtraPlannedUses)) {
      const extra = plan.portions.reduce((sum, quantity) => sum + quantity.value, 0)
      if (!(extra > 0)) continue
      out.push({
        ...candidate,
        id: `${candidate.id}:batch:${plan.key}`,
        extraUses: plan.slots.length,
        extraQuantity: { value: extra, unit: prepPortion.unit },
        proposedEventId: `${row.slot.id}:${main.id}`,
        batchRecipeId: main.id,
        plannedConsumerSlotIds: plan.slots.map((slot) => slot.slot.id),
      })
    }
  }
  return out
}
