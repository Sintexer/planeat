import convert from 'convert-units'
import Fraction from 'fraction.js'
import type { MeasurementPreference } from '../../domain/shared/Locale'
import { presentQuantity } from '../../domain/shared/presentQuantity'
import type { Quantity } from '../../domain/shared/Quantity'
import { formatQuantity as formatQuantityPlain } from '../../domain/shared/formatQuantity'
import { scaleQuantity as scaleQuantityPure } from '../../domain/shared/scaleQuantity'
import { findUnitDefinition } from '../../domain/shared/UnitRegistry'

/**
 * Map app quantity units onto convert-units abbreviations, via the explicit
 * unit registry. `legacy` units (bare `cup`, pre-Sprint-12) are excluded from
 * cross-unit resolution — an unspecified cup stays unspecified. Culinary spoons
 * (`tsp`, `tbsp`) do convert with other known volumes. `piece` / `serving` /
 * `cup-metric` have no `convertUnit` and stay self-only.
 */
function toConvertUnit(unit: string): string | null {
  const definition = findUnitDefinition(unit)
  if (!definition || definition.legacy) return null
  return definition.convertUnit ?? null
}

function isCulinarySpoon(unit: string): boolean {
  return unit === 'tsp' || unit === 'tbsp'
}

/** The canonical unit to convert into for display under a given preference, or null if this unit's family isn't converted (count units, or units with no known conversion at all). */
function canonicalUnitFor(unit: string, preference: MeasurementPreference): string | null {
  const definition = findUnitDefinition(unit)
  if (!definition || definition.legacy || preference === 'as-entered') return null
  if (isCulinarySpoon(unit)) return null
  if (definition.family === 'mass') return preference === 'metric' ? 'g' : 'oz-mass'
  if (definition.family === 'volume') return preference === 'metric' ? 'ml' : 'oz-fl'
  return null
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

  /**
   * Grocery totals: keep a shared unit when both sides use it; mixed convertible
   * volumes become milliliters (spoons stay spoons until mixed with cups/ml).
   */
  addForGrocery(a: Quantity | null, b: Quantity | null): Quantity | null {
    if (a === null || b === null) return null
    if (a.unit === b.unit) return this.add(a, b)
    const familyA = findUnitDefinition(a.unit)?.family
    const familyB = findUnitDefinition(b.unit)?.family
    if (familyA === 'volume' && familyB === 'volume' && this.canConvert(a, b)) {
      const aMl = this.convert(a, 'ml')
      const bMl = this.convert(b, 'ml')
      return this.add(aMl, bMl)
    }
    return this.add(a, b)
  }

  convert(quantity: Quantity, targetUnit: string): Quantity | null {
    if (quantity.unit === targetUnit) return { ...quantity }
    const from = toConvertUnit(quantity.unit)
    const to = toConvertUnit(targetUnit)
    if (!from || !to) return null
    try {
      const value = convert(quantity.value)
        .from(from as convert.Unit)
        .to(to as convert.Unit)
      return { value, unit: targetUnit }
    } catch {
      return null
    }
  }

  /**
   * Subtract `b` from `a` when units are compatible.
   * Result uses `a.unit`. Returns null when either side is null or units cannot convert.
   */
  subtract(a: Quantity | null, b: Quantity | null): Quantity | null {
    if (a === null || b === null) return null
    if (a.unit === b.unit) {
      return {
        value: new Fraction(a.value).sub(b.value).valueOf(),
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
        value: new Fraction(a.value).sub(bInA).valueOf(),
        unit: a.unit,
      }
    } catch {
      return null
    }
  }

  /**
   * Compare two quantities when units are compatible.
   * Returns -1 / 0 / 1, or null when either side is null or units cannot convert.
   */
  compare(a: Quantity | null, b: Quantity | null): -1 | 0 | 1 | null {
    if (a === null || b === null) return null
    if (a.unit === b.unit) {
      const diff = new Fraction(a.value).sub(b.value).valueOf()
      if (diff < 0) return -1
      if (diff > 0) return 1
      return 0
    }
    const fromA = toConvertUnit(a.unit)
    const fromB = toConvertUnit(b.unit)
    if (!fromA || !fromB) return null
    try {
      const bInA = convert(b.value)
        .from(fromB as convert.Unit)
        .to(fromA as convert.Unit)
      const diff = new Fraction(a.value).sub(bInA).valueOf()
      if (diff < 0) return -1
      if (diff > 0) return 1
      return 0
    } catch {
      return null
    }
  }

  /**
   * Converts a quantity into the unit most appropriate for `preference`,
   * for display only — never mutates or reinterprets the stored quantity.
   * Legacy units (`cup`), culinary spoons (`tsp`/`tbsp`), `cup-metric`,
   * `piece`/`serving`, and any unrecognized unit pass through unchanged
   * under every preference. Mixed grocery totals may already be stored in `ml`.
   */
  presentForDisplay(quantity: Quantity | null, preference: MeasurementPreference): Quantity | null {
    if (quantity === null) return null
    const targetUnit = canonicalUnitFor(quantity.unit, preference)
    if (!targetUnit || targetUnit === quantity.unit) {
      return presentQuantity(quantity, preference)
    }
    const fromUnit = toConvertUnit(quantity.unit)
    const toUnit = toConvertUnit(targetUnit)
    if (!fromUnit || !toUnit) return quantity
    try {
      const converted = convert(quantity.value)
        .from(fromUnit as convert.Unit)
        .to(toUnit as convert.Unit)
      return presentQuantity({ value: converted, unit: targetUnit }, preference)
    } catch {
      return quantity
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
