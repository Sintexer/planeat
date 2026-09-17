import { describe, expect, it } from 'vitest'
import { presentQuantity } from './presentQuantity'

describe('presentQuantity — as-entered', () => {
  it('returns every unit family unchanged', () => {
    for (const quantity of [
      { value: 1500, unit: 'g' },
      { value: 1, unit: 'cup-us' },
      { value: 1, unit: 'piece' },
      { value: 1, unit: 'cup' },
    ]) {
      expect(presentQuantity(quantity, 'as-entered')).toEqual(quantity)
    }
  })
})

describe('presentQuantity — metric', () => {
  it('promotes grams to kilograms at the 1000 g threshold', () => {
    expect(presentQuantity({ value: 1500, unit: 'g' }, 'metric')).toEqual({
      value: 1.5,
      unit: 'kg',
    })
  })

  it('demotes kilograms to grams below 1 kg', () => {
    expect(presentQuantity({ value: 0.5, unit: 'kg' }, 'metric')).toEqual({
      value: 500,
      unit: 'g',
    })
  })

  it('promotes milliliters to liters at the 1000 ml threshold', () => {
    expect(presentQuantity({ value: 1500, unit: 'ml' }, 'metric')).toEqual({
      value: 1.5,
      unit: 'l',
    })
  })

  it('demotes liters to milliliters below 1 l', () => {
    expect(presentQuantity({ value: 0.5, unit: 'l' }, 'metric')).toEqual({
      value: 500,
      unit: 'ml',
    })
  })

  it('leaves values already at the right magnitude unchanged', () => {
    expect(presentQuantity({ value: 200, unit: 'g' }, 'metric')).toEqual({
      value: 200,
      unit: 'g',
    })
  })

  it('leaves a non-metric unit unchanged (cross-family conversion is not its job)', () => {
    expect(presentQuantity({ value: 1, unit: 'cup-us' }, 'metric')).toEqual({
      value: 1,
      unit: 'cup-us',
    })
  })
})

describe('presentQuantity — us-customary', () => {
  it('promotes fluid ounces to US cups at the 8 fl oz threshold', () => {
    expect(presentQuantity({ value: 16, unit: 'oz-fl' }, 'us-customary')).toEqual({
      value: 2,
      unit: 'cup-us',
    })
  })

  it('demotes US cups to fluid ounces below 1 cup', () => {
    expect(presentQuantity({ value: 0.5, unit: 'cup-us' }, 'us-customary')).toEqual({
      value: 4,
      unit: 'oz-fl',
    })
  })

  it('leaves oz-mass unchanged — no further magnitude split for mass', () => {
    expect(presentQuantity({ value: 3, unit: 'oz-mass' }, 'us-customary')).toEqual({
      value: 3,
      unit: 'oz-mass',
    })
  })

  it('leaves a metric unit unchanged (cross-family conversion is not its job)', () => {
    expect(presentQuantity({ value: 100, unit: 'g' }, 'us-customary')).toEqual({
      value: 100,
      unit: 'g',
    })
  })
})

describe('presentQuantity — purity', () => {
  it('does not mutate the input quantity', () => {
    const input = { value: 1500, unit: 'g' }
    const inputCopy = { ...input }
    presentQuantity(input, 'metric')
    expect(input).toEqual(inputCopy)
  })
})
