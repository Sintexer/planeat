import type { MeasurementPreference } from './Locale'
import type { Quantity } from './Quantity'

/**
 * Picks the best display magnitude *within* a unit family the caller has
 * already converted into (e.g. everything metric-mass expressed in `g`,
 * everything US-customary-volume expressed in `oz-fl`). This function never
 * converts between families — that requires convert-units and lives behind
 * `QuantityService.presentForDisplay`, per the architecture rule that keeps
 * convert-units wrapped out of `domain/`.
 */
export function presentQuantity(quantity: Quantity, preference: MeasurementPreference): Quantity {
  if (preference === 'metric') {
    if (quantity.unit === 'g' && quantity.value >= 1000) {
      return { value: quantity.value / 1000, unit: 'kg' }
    }
    if (quantity.unit === 'kg' && quantity.value < 1) {
      return { value: quantity.value * 1000, unit: 'g' }
    }
    if (quantity.unit === 'ml' && quantity.value >= 1000) {
      return { value: quantity.value / 1000, unit: 'l' }
    }
    if (quantity.unit === 'l' && quantity.value < 1) {
      return { value: quantity.value * 1000, unit: 'ml' }
    }
    return quantity
  }

  if (preference === 'us-customary') {
    // 1 US cup = 8 fl oz.
    if (quantity.unit === 'oz-fl' && quantity.value >= 8) {
      return { value: quantity.value / 8, unit: 'cup-us' }
    }
    if (quantity.unit === 'cup-us' && quantity.value < 1) {
      return { value: quantity.value * 8, unit: 'oz-fl' }
    }
    return quantity
  }

  return quantity
}
