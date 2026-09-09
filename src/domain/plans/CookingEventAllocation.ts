import type { RecipeId } from '../recipes/Recipe'
import type { LocalDate } from '../shared/LocalDate'
import type { ReusePolicy } from '../shared/MealEnums'
import type { Quantity } from '../shared/Quantity'
import type { CookingEvent, CookingEventId } from './CookingEvent'
import type { MealComponent } from './MealComponent'

export type ReuseCheckResult = 'ok' | 'before-prep' | 'reuse-forbidden'

/**
 * Meal date vs prep date under the recipe reuse policy.
 * fresh-only and same-day both require the meal on the prep calendar day.
 */
export function checkReusePolicy(
  policy: ReusePolicy,
  scheduledDate: LocalDate,
  mealDate: LocalDate,
): ReuseCheckResult {
  if (mealDate < scheduledDate) return 'before-prep'
  if (policy === 'batch-friendly') return 'ok'
  if (mealDate === scheduledDate) return 'ok'
  return 'reuse-forbidden'
}

export function isReuseAllowed(
  policy: ReusePolicy,
  scheduledDate: LocalDate,
  mealDate: LocalDate,
): boolean {
  return checkReusePolicy(policy, scheduledDate, mealDate) === 'ok'
}

/** Components that reference a cooking event (optionally excluding one component). */
export function componentsForCookingEvent(
  components: readonly MealComponent[],
  cookingEventId: CookingEventId,
  excludeComponentId?: string,
): MealComponent[] {
  return components.filter((c) => {
    if (excludeComponentId && c.id === excludeComponentId) return false
    return c.source.type === 'cooking-event' && c.source.cookingEventId === cookingEventId
  })
}

/**
 * Sum allocated quantities when every allocation shares the same unit.
 * Returns null when the list is empty or units differ (caller should convert first).
 */
export function sumAllocatedSameUnit(allocations: readonly Quantity[]): Quantity | null {
  if (allocations.length === 0) return null
  const unit = allocations[0].unit
  let total = 0
  for (const q of allocations) {
    if (q.unit !== unit) return null
    total += q.value
  }
  return { value: total, unit }
}

/**
 * Remaining output when units match: output − sum(allocations).
 * Returns null if units are incompatible or inputs are invalid.
 */
export function remainingSameUnit(
  output: Quantity,
  allocations: readonly Quantity[],
): Quantity | null {
  if (allocations.length === 0) return { ...output }
  const sum = sumAllocatedSameUnit(allocations)
  if (!sum) return null
  if (sum.unit !== output.unit) return null
  return { value: output.value - sum.value, unit: output.unit }
}

export function hasPositiveRemaining(remaining: Quantity | null): boolean {
  return remaining !== null && Number.isFinite(remaining.value) && remaining.value > 0
}

export function hasUnallocatedRemainder(remaining: Quantity | null): boolean {
  return hasPositiveRemaining(remaining)
}

/**
 * Whether `additional` fits in remaining capacity (same-unit arithmetic).
 * `excludeComponentId` drops that component from the current sum (for updates).
 */
export function canAllocateSameUnit(
  output: Quantity,
  components: readonly MealComponent[],
  cookingEventId: CookingEventId,
  additional: Quantity,
  excludeComponentId?: string,
): 'ok' | 'over-allocated' | 'incompatible-quantity' {
  if (additional.unit !== output.unit) return 'incompatible-quantity'
  const current = componentsForCookingEvent(components, cookingEventId, excludeComponentId).map(
    (c) => c.allocatedQuantity,
  )
  for (const q of current) {
    if (q.unit !== output.unit) return 'incompatible-quantity'
  }
  const remaining = remainingSameUnit(output, current)
  if (!remaining) return 'incompatible-quantity'
  if (additional.value > remaining.value + 1e-9) return 'over-allocated'
  return 'ok'
}

export function listEligibleCookingEvents(
  events: readonly CookingEvent[],
  recipeId: RecipeId,
  mealDate: LocalDate,
  remainingByEventId: ReadonlyMap<CookingEventId, Quantity | null>,
): CookingEvent[] {
  return events.filter((event) => {
    if (event.recipeId !== recipeId) return false
    const policy = event.recipeSnapshot.reusePolicy
    if (!isReuseAllowed(policy, event.scheduledDate, mealDate)) return false
    const remaining = remainingByEventId.get(event.id) ?? null
    return hasPositiveRemaining(remaining)
  })
}
