import type { Quantity } from './Quantity'

/**
 * Pure scale of a quantity by a positive factor.
 * Returns null when quantity is missing (unknown stays unknown).
 */
export function scaleQuantity(quantity: Quantity | null, factor: number): Quantity | null {
  if (quantity === null) return null
  if (!Number.isFinite(factor) || factor <= 0) {
    return { ...quantity }
  }
  return {
    value: quantity.value * factor,
    unit: quantity.unit,
  }
}

export function scaleFactor(fromYield: Quantity, toYield: Quantity): number | null {
  if (fromYield.unit !== toYield.unit) return null
  if (fromYield.value === 0) return null
  return toYield.value / fromYield.value
}
