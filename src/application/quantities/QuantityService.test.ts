import { describe, expect, it } from 'vitest'
import { QuantityService } from './QuantityService'

const service = new QuantityService()

describe('canConvert', () => {
  it('500 g and 1 kg are compatible', () => {
    expect(service.canConvert({ value: 500, unit: 'g' }, { value: 1, unit: 'kg' })).toBe(true)
  })

  it('200 g and 1 cup (flour) are not compatible', () => {
    expect(service.canConvert({ value: 200, unit: 'g' }, { value: 1, unit: 'cup' })).toBe(false)
  })

  it('a bare legacy cup no longer cross-converts with ml (deliberate behavior change)', () => {
    // Before Sprint 13, CONVERT_UNIT_ALIAS.cup = 'cup' meant a bare cup silently
    // assumed the US customary convention for math purposes. Now `cup` is a
    // `legacy` registry entry excluded from cross-unit resolution entirely.
    expect(service.canConvert({ value: 1, unit: 'cup' }, { value: 240, unit: 'ml' })).toBe(false)
  })

  it('a bare legacy cup still matches itself via the same-unit fast path', () => {
    expect(service.canConvert({ value: 1, unit: 'cup' }, { value: 2, unit: 'cup' })).toBe(true)
  })

  it('legacy tbsp behaves the same as legacy cup', () => {
    expect(service.canConvert({ value: 1, unit: 'tbsp' }, { value: 15, unit: 'ml' })).toBe(false)
    expect(service.canConvert({ value: 1, unit: 'tbsp' }, { value: 2, unit: 'tbsp' })).toBe(true)
  })

  it('oz-mass is compatible with g and kg', () => {
    expect(service.canConvert({ value: 1, unit: 'oz-mass' }, { value: 28, unit: 'g' })).toBe(true)
    expect(service.canConvert({ value: 1, unit: 'oz-mass' }, { value: 1, unit: 'kg' })).toBe(true)
  })

  it('oz-fl is compatible with ml, l, and cup-us', () => {
    expect(service.canConvert({ value: 1, unit: 'oz-fl' }, { value: 30, unit: 'ml' })).toBe(true)
    expect(service.canConvert({ value: 1, unit: 'oz-fl' }, { value: 1, unit: 'l' })).toBe(true)
    expect(service.canConvert({ value: 1, unit: 'oz-fl' }, { value: 1, unit: 'cup-us' })).toBe(true)
  })

  it('cup-us is compatible with ml, l, tsp', () => {
    expect(service.canConvert({ value: 1, unit: 'cup-us' }, { value: 240, unit: 'ml' })).toBe(true)
    expect(service.canConvert({ value: 1, unit: 'cup-us' }, { value: 1, unit: 'l' })).toBe(true)
    expect(service.canConvert({ value: 1, unit: 'cup-us' }, { value: 5, unit: 'tsp' })).toBe(true)
  })

  it('cup-metric is only compatible with itself', () => {
    expect(
      service.canConvert({ value: 1, unit: 'cup-metric' }, { value: 1, unit: 'cup-metric' }),
    ).toBe(true)
    expect(service.canConvert({ value: 1, unit: 'cup-metric' }, { value: 250, unit: 'ml' })).toBe(
      false,
    )
    expect(service.canConvert({ value: 1, unit: 'cup-metric' }, { value: 1, unit: 'cup-us' })).toBe(
      false,
    )
  })

  it('piece and serving are never cross-convertible, including with each other', () => {
    expect(service.canConvert({ value: 1, unit: 'piece' }, { value: 1, unit: 'g' })).toBe(false)
    expect(service.canConvert({ value: 1, unit: 'piece' }, { value: 1, unit: 'serving' })).toBe(
      false,
    )
  })

  it('an entirely unknown unit string still matches itself', () => {
    expect(service.canConvert({ value: 1, unit: 'xyz' }, { value: 2, unit: 'xyz' })).toBe(true)
  })

  it('two different unknown unit strings do not convert', () => {
    expect(service.canConvert({ value: 1, unit: 'xyz' }, { value: 1, unit: 'abc' })).toBe(false)
  })
})

describe('add', () => {
  it('500 g + 1 kg = 1.5 kg (or 1.5 g depending on operand order)', () => {
    const gPlusKg = service.add({ value: 500, unit: 'g' }, { value: 1, unit: 'kg' })
    expect(gPlusKg).toEqual({ value: 1500, unit: 'g' })

    const kgPlusG = service.add({ value: 1, unit: 'kg' }, { value: 500, unit: 'g' })
    expect(kgPlusG).toEqual({ value: 1.5, unit: 'kg' })
  })

  it('returns null for incompatible units', () => {
    expect(service.add({ value: 200, unit: 'g' }, { value: 1, unit: 'cup' })).toBeNull()
  })

  it('returns null for a legacy cup + ml (deliberate behavior change)', () => {
    expect(service.add({ value: 1, unit: 'cup' }, { value: 240, unit: 'ml' })).toBeNull()
  })

  it('still works for two bare-cup quantities', () => {
    expect(service.add({ value: 1, unit: 'cup' }, { value: 2, unit: 'cup' })).toEqual({
      value: 3,
      unit: 'cup',
    })
  })

  it('returns null whenever either operand is null', () => {
    expect(service.add(null, { value: 1, unit: 'g' })).toBeNull()
    expect(service.add({ value: 1, unit: 'g' }, null)).toBeNull()
  })
})

describe('subtract', () => {
  it('subtracts compatible units', () => {
    expect(service.subtract({ value: 1, unit: 'kg' }, { value: 500, unit: 'g' })).toEqual({
      value: 0.5,
      unit: 'kg',
    })
  })

  it('returns null for incompatible units', () => {
    expect(service.subtract({ value: 200, unit: 'g' }, { value: 1, unit: 'cup' })).toBeNull()
  })

  it('still works for two bare-cup quantities', () => {
    expect(service.subtract({ value: 3, unit: 'cup' }, { value: 1, unit: 'cup' })).toEqual({
      value: 2,
      unit: 'cup',
    })
  })

  it('returns null whenever either operand is null', () => {
    expect(service.subtract(null, null)).toBeNull()
  })
})

describe('compare', () => {
  it('compares compatible units', () => {
    expect(service.compare({ value: 1, unit: 'kg' }, { value: 500, unit: 'g' })).toBe(1)
    expect(service.compare({ value: 500, unit: 'g' }, { value: 1, unit: 'kg' })).toBe(-1)
    expect(service.compare({ value: 1, unit: 'kg' }, { value: 1000, unit: 'g' })).toBe(0)
  })

  it('returns null for incompatible units', () => {
    expect(service.compare({ value: 200, unit: 'g' }, { value: 1, unit: 'cup' })).toBeNull()
  })

  it('returns null whenever either operand is null', () => {
    expect(service.compare(null, { value: 1, unit: 'g' })).toBeNull()
  })
})

describe('scale', () => {
  it('scales a known unit by a positive factor', () => {
    expect(service.scale({ value: 2, unit: 'g' }, 1.5)).toEqual({ value: 3, unit: 'g' })
  })

  it('scales every unit identically, including brand-new registry keys and totally unknown strings', () => {
    for (const unit of ['g', 'oz-mass', 'cup-us', 'cup-metric', 'oz-fl', 'totally-unknown-unit']) {
      expect(service.scale({ value: 2, unit }, 1.5)).toEqual({ value: 3, unit })
    }
  })

  it('returns the quantity unchanged for a non-finite or non-positive factor', () => {
    expect(service.scale({ value: 2, unit: 'g' }, 0)).toEqual({ value: 2, unit: 'g' })
    expect(service.scale({ value: 2, unit: 'g' }, NaN)).toEqual({ value: 2, unit: 'g' })
  })

  it('returns null when scaling a null quantity', () => {
    expect(service.scale(null, 2)).toBeNull()
  })
})

describe('presentForDisplay', () => {
  it('as-entered never changes anything', () => {
    for (const quantity of [
      { value: 1, unit: 'g' },
      { value: 1, unit: 'ml' },
      { value: 1, unit: 'cup-us' },
      { value: 1, unit: 'piece' },
      { value: 1, unit: 'cup' },
    ]) {
      expect(service.presentForDisplay(quantity, 'as-entered')).toEqual(quantity)
    }
  })

  it('metric converts cup-us into ml', () => {
    expect(service.presentForDisplay({ value: 1, unit: 'cup-us' }, 'metric')).toEqual({
      value: expect.closeTo(236.588, 1),
      unit: 'ml',
    })
  })

  it('metric converts oz-mass into g', () => {
    expect(service.presentForDisplay({ value: 1, unit: 'oz-mass' }, 'metric')).toEqual({
      value: expect.closeTo(28.35, 1),
      unit: 'g',
    })
  })

  it('metric converts a large oz-fl quantity across the l threshold', () => {
    const result = service.presentForDisplay({ value: 40, unit: 'oz-fl' }, 'metric')
    expect(result?.unit).toBe('l')
    expect(result?.value).toBeCloseTo(1.183, 2)
  })

  it('metric still applies plain g/kg thresholding with no conversion needed', () => {
    expect(service.presentForDisplay({ value: 1500, unit: 'g' }, 'metric')).toEqual({
      value: 1.5,
      unit: 'kg',
    })
  })

  it('us-customary converts ml into cup-us', () => {
    const result = service.presentForDisplay({ value: 240, unit: 'ml' }, 'us-customary')
    expect(result?.unit).toBe('cup-us')
    expect(result?.value).toBeCloseTo(1, 1)
  })

  it('us-customary keeps a small ml quantity in oz-fl (under the cup threshold)', () => {
    const result = service.presentForDisplay({ value: 30, unit: 'ml' }, 'us-customary')
    expect(result?.unit).toBe('oz-fl')
    expect(result?.value).toBeLessThan(8)
  })

  it('us-customary converts g into oz-mass', () => {
    const result = service.presentForDisplay({ value: 100, unit: 'g' }, 'us-customary')
    expect(result?.unit).toBe('oz-mass')
    expect(result?.value).toBeCloseTo(3.53, 1)
  })

  it('never converts legacy cup or tbsp under any preference', () => {
    for (const preference of ['metric', 'us-customary'] as const) {
      expect(service.presentForDisplay({ value: 1, unit: 'cup' }, preference)).toEqual({
        value: 1,
        unit: 'cup',
      })
      expect(service.presentForDisplay({ value: 1, unit: 'tbsp' }, preference)).toEqual({
        value: 1,
        unit: 'tbsp',
      })
    }
  })

  it('never converts cup-metric under any preference', () => {
    for (const preference of ['metric', 'us-customary'] as const) {
      expect(service.presentForDisplay({ value: 1, unit: 'cup-metric' }, preference)).toEqual({
        value: 1,
        unit: 'cup-metric',
      })
    }
  })

  it('never converts piece or serving under any preference', () => {
    for (const preference of ['metric', 'us-customary'] as const) {
      expect(service.presentForDisplay({ value: 1, unit: 'piece' }, preference)).toEqual({
        value: 1,
        unit: 'piece',
      })
      expect(service.presentForDisplay({ value: 1, unit: 'serving' }, preference)).toEqual({
        value: 1,
        unit: 'serving',
      })
    }
  })

  it('returns null for a null quantity under every preference', () => {
    for (const preference of ['as-entered', 'metric', 'us-customary'] as const) {
      expect(service.presentForDisplay(null, preference)).toBeNull()
    }
  })

  it('does not mutate the input quantity', () => {
    const input = { value: 1, unit: 'cup-us' }
    const inputCopy = { ...input }
    service.presentForDisplay(input, 'metric')
    expect(input).toEqual(inputCopy)
  })
})
