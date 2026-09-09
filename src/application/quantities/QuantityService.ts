import convert from 'convert-units'
import Fraction from 'fraction.js'
import type { Quantity } from '../../domain/shared/Quantity'
import { formatQuantity as formatQuantityPlain } from '../../domain/shared/formatQuantity'
import { scaleQuantity as scaleQuantityPure } from '../../domain/shared/scaleQuantity'

/**
 * Map app quantity units onto convert-units abbreviations.
 * `piece` / `serving` are countable and never cross-converted.
 */
const CONVERT_UNIT_ALIAS: Record<string, string> = {
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'l',
  tsp: 'tsp',
  tbsp: 'Tbs',
  cup: 'cup',
}

function toConvertUnit(unit: string): string | null {
  return CONVERT_UNIT_ALIAS[unit] ?? null
}

/**
 * Adapter around fraction.js + convert-units for scale/add/format.
 * Persist only plain `{ value, unit }` — never library instances.
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

  canConvert(a: Quantity, b: Quantity): boolean {
    if (a.unit === b.unit) return true
    const from = toConvertUnit(a.unit)
    const to = toConvertUnit(b.unit)
    if (!from || !to) return false
    try {
      convert(1)
        .from(from as convert.Unit)
        .to(to as convert.Unit)
      return true
    } catch {
      return false
    }
  }

  /**
   * Add two quantities when units are compatible.
   * Result uses `a.unit`. Returns null when either side is null or units cannot convert.
   */
  add(a: Quantity | null, b: Quantity | null): Quantity | null {
    if (a === null || b === null) return null
    if (a.unit === b.unit) {
      return {
        value: new Fraction(a.value).add(b.value).valueOf(),
        unit: a.unit,
      }
    }
    const fromA = toConvertUnit(a.unit)
    const fromB = toConvertUnit(b.unit)
    if (!fromA || !fromB) return null
    try {
      const bInA = convert(b.value)
        .from(fromB as convert.Unit)
        .to(fromA as convert.Unit)
      return {
        value: new Fraction(a.value).add(bInA).valueOf(),
        unit: a.unit,
      }
    } catch {
      return null
    }
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
