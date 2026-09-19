import type { Quantity } from '../../shared/Quantity'
import type { MealSlot } from '../MealSlot'
import { isReuseAllowed } from '../CookingEventAllocation'
import { compositionStillEligible } from './compositions'
import {
  fingerprintFromInput,
  mergeGenerationMode,
  type GenerationInput,
  type GenerationMode,
  type WeekGenerationProposal,
} from './proposal'

export type GenerationSlotError = 'slot-excluded' | 'slot-not-empty' | 'slot-locked'

export type GenerationApplyError =
  | GenerationSlotError
  | 'slot-not-found'
  | 'not-found'
  | 'stale-proposal'
  | 'recipe-not-found'
  | 'simple-food-not-found'
  | 'cooking-event-not-found'
  | 'invalid-quantity'
  | 'over-allocated'
  | 'reuse-forbidden'
  | 'before-prep'
  | 'slot-locked'
  | 'dependents-locked'
  | 'replace-dependents-required'

export function isValidPositiveQuantity(quantity: Quantity): boolean {
  return Number.isFinite(quantity.value) && quantity.value > 0 && quantity.unit.length > 0
}

export function validateSlotForGeneration(
  slot: MealSlot,
  componentCount: number,
  mode: GenerationMode = 'fill-empty',
): GenerationSlotError | undefined {
  if (slot.excluded) return 'slot-excluded'
  if (slot.generationLocked) return 'slot-locked'
  if (mergeGenerationMode(mode) === 'fill-empty' && componentCount > 0) return 'slot-not-empty'
  return undefined
}

export function validateProposalAgainstLive(
  proposal: WeekGenerationProposal,
  live: GenerationInput,
): GenerationApplyError | undefined {
  if (live.planId !== proposal.planId) return 'stale-proposal'
  if (fingerprintFromInput(live) !== proposal.fingerprint) return 'stale-proposal'

  const liveById = new Map(live.requestedSlots.map((row) => [row.slot.id, row]))
  const recipes = new Map((live.recipes ?? []).map((recipe) => [recipe.id, recipe]))
  const foods = new Map((live.simpleFoods ?? []).map((food) => [food.id, food]))
  const events = new Map((live.cookingEvents ?? []).map((event) => [event.id, event]))
  const remainingByEventId = new Map(
    (live.cookingEvents ?? []).map((event) => [event.id, { ...event.remaining }]),
  )

  for (const assignment of proposal.assignments) {
    const requested = liveById.get(assignment.slotId)
    if (!requested) return 'slot-not-found'
    const slotIssue = validateSlotForGeneration(
      requested.slot,
      requested.componentCount,
      live.generationMode,
    )
    if (slotIssue) return slotIssue
    if (assignment.components.length === 0) return 'stale-proposal'
    for (const component of assignment.components) {
      if (component.type === 'recipe') {
        const recipe = recipes.get(component.recipeId)
        if (!recipe) return 'recipe-not-found'
        if (
          !isValidPositiveQuantity(component.outputQuantity) ||
          !isValidPositiveQuantity(component.allocatedQuantity)
        ) {
          return 'invalid-quantity'
        }
        if (component.proposedEventId) {
          if (component.outputQuantity.unit !== component.allocatedQuantity.unit) {
            return 'invalid-quantity'
          }
          const extraValue = component.outputQuantity.value - component.allocatedQuantity.value
          if (extraValue <= 0) return 'invalid-quantity'
          remainingByEventId.set(component.proposedEventId, {
            value: extraValue,
            unit: component.outputQuantity.unit,
          })
          events.set(component.proposedEventId, {
            id: component.proposedEventId,
            recipeId: recipe.id,
            recipeName: recipe.name,
            scheduledDate: requested.slot.date,
            outputQuantity: component.outputQuantity,
            remaining: { value: extraValue, unit: component.outputQuantity.unit },
            desiredQuantity: component.allocatedQuantity,
            reusePolicy: recipe.reusePolicy,
            mealTypes: recipe.mealTypes,
            recipe,
            proposed: true,
            producerSlotId: requested.slot.id,
          })
        }
      } else if (component.type === 'simple-food') {
        if (!foods.has(component.simpleFoodId)) return 'simple-food-not-found'
        if (!isValidPositiveQuantity(component.allocatedQuantity)) return 'invalid-quantity'
      } else {
        const eventId = component.proposedEventId ?? component.cookingEventId
        const event = events.get(eventId)
        if (!event) return 'cooking-event-not-found'
        if (!isValidPositiveQuantity(component.allocatedQuantity)) return 'invalid-quantity'
        if (!isReuseAllowed(event.reusePolicy, event.scheduledDate, requested.slot.date)) {
          return requested.slot.date < event.scheduledDate ? 'before-prep' : 'reuse-forbidden'
        }
        const remaining = remainingByEventId.get(eventId)
        if (!remaining || remaining.unit !== component.allocatedQuantity.unit) {
          return 'invalid-quantity'
        }
        if (component.allocatedQuantity.value > remaining.value + 1e-9) return 'over-allocated'
        remainingByEventId.set(eventId, {
          value: remaining.value - component.allocatedQuantity.value,
          unit: remaining.unit,
        })
      }
    }
    if (!compositionStillEligible(assignment, live, requested.slot.mealType, requested.slot.date)) {
      return 'stale-proposal'
    }
  }

  return undefined
}
