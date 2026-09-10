import type { MeasurementPreference } from './Locale'
import type { Quantity } from './Quantity'

export function presentQuantity(quantity: Quantity, preference: MeasurementPreference): Quantity {
  if (preference !== 'metric') return quantity

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
