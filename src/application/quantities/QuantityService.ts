import Fraction from 'fraction.js'
import type { Quantity } from '../../domain/shared/Quantity'
import { formatQuantity as formatQuantityPlain } from '../../domain/shared/formatQuantity'
import { scaleQuantity as scaleQuantityPure } from '../../domain/shared/scaleQuantity'

/**
 * Adapter around fraction.js for scale/format.
 * Persist only plain `{ value, unit }` — never Fraction instances.
 */
export class QuantityService {
  scale(quantity: Quantity | null, factor: number): Quantity | null {
    if (quantity === null) return null
    if (!Number.isFinite(factor) || factor <= 0) {
      return { ...quantity }
    }
    const scaled = new Fraction(quantity.value).mul(factor)
    return {
      value: scaled.valueOf(),
      unit: quantity.unit,
    }
  }

  /** Scale using pure domain math (same numeric result for typical factors). */
  scalePlain(quantity: Quantity | null, factor: number): Quantity | null {
    return scaleQuantityPure(quantity, factor)
  }

  format(quantity: Quantity | null): string {
    if (quantity === null) return 'quantity unspecified'
    const fraction = new Fraction(quantity.value)
    const valueText = fraction.toFraction(true)
    return `${valueText} ${quantity.unit}`
  }

  formatPlain(quantity: Quantity | null): string {
    return formatQuantityPlain(quantity)
  }
}
