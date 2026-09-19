import type { Quantity } from '../../shared/Quantity'
import type { MealSlot } from '../MealSlot'
import { isReuseAllowed } from '../CookingEventAllocation'
import { compositionStillEligible } from './compositions'
import { fingerprintFromInput, type GenerationInput, type WeekGenerationProposal } from './proposal'

export type GenerationSlotError = 'slot-excluded' | 'slot-not-empty'

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

export function isValidPositiveQuantity(quantity: Quantity): boolean {
  return Number.isFinite(quantity.value) && quantity.value > 0 && quantity.unit.length > 0
}

export function validateSlotForGeneration(
  slot: MealSlot,
  componentCount: number,
): GenerationSlotError | undefined {
  if (slot.excluded) return 'slot-excluded'
  if (componentCount > 0) return 'slot-not-empty'
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
    const slotIssue = validateSlotForGeneration(requested.slot, requested.componentCount)
    if (slotIssue) return slotIssue
    if (assignment.components.length === 0) return 'stale-proposal'
    for (const component of assignment.components) {
      if (component.type === 'recipe') {
        if (!recipes.has(component.recipeId)) return 'recipe-not-found'
        if (
          !isValidPositiveQuantity(component.outputQuantity) ||
          !isValidPositiveQuantity(component.allocatedQuantity)
        ) {
          return 'invalid-quantity'
        }
      } else if (component.type === 'simple-food') {
        if (!foods.has(component.simpleFoodId)) return 'simple-food-not-found'
        if (!isValidPositiveQuantity(component.allocatedQuantity)) return 'invalid-quantity'
      } else {
        const event = events.get(component.cookingEventId)
        if (!event) return 'cooking-event-not-found'
        if (!isValidPositiveQuantity(component.allocatedQuantity)) return 'invalid-quantity'
        if (!isReuseAllowed(event.reusePolicy, event.scheduledDate, requested.slot.date)) {
          return requested.slot.date < event.scheduledDate ? 'before-prep' : 'reuse-forbidden'
        }
        const remaining = remainingByEventId.get(component.cookingEventId)
        if (!remaining || remaining.unit !== component.allocatedQuantity.unit) {
          return 'invalid-quantity'
        }
        if (component.allocatedQuantity.value > remaining.value + 1e-9) return 'over-allocated'
        remainingByEventId.set(component.cookingEventId, {
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
