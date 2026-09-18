import { describe, expect, it } from 'vitest'
import { parseIngredientLine } from './parseIngredientLine'

describe('parseIngredientLine', () => {
  it('keeps 2 cups flour as unspecified cup with original text', () => {
    const parsed = parseIngredientLine('2 cups flour')
    expect(parsed).toMatchObject({
      name: 'flour',
      quantityValue: 2,
      quantityUnit: 'cup',
      measurementStatus: 'ambiguous-cup',
      originalText: '2 cups flour',
      quantityText: '',
    })
  })

  it('treats tablespoon as a known culinary unit', () => {
    const parsed = parseIngredientLine('1 tbsp oil')
    expect(parsed).toMatchObject({
      name: 'oil',
      quantityValue: 1,
      quantityUnit: 'tbsp',
      measurementStatus: 'known',
      originalText: '1 tbsp oil',
    })
  })

  it('does not map ounces onto piece', () => {
    const parsed = parseIngredientLine('8 oz cheese')
    expect(parsed.quantityUnit).not.toBe('piece')
    expect(parsed).toMatchObject({
      name: 'cheese',
      quantityValue: 8,
      quantityUnit: 'oz',
      measurementStatus: 'ambiguous-oz',
      originalText: '8 oz cheese',
    })
  })

  it('keeps salt to taste as quantityText, not an invented gram unit', () => {
    const parsed = parseIngredientLine('salt to taste')
    expect(parsed.measurementStatus).toBe('unresolved')
    expect(parsed.quantityValue).toBe('')
    expect(parsed.quantityUnit).not.toBe('g')
    expect(parsed.quantityText).toBe('salt to taste')
    expect(parsed.originalText).toBe('salt to taste')
  })

  it('does not collapse a range to the low end', () => {
    const parsed = parseIngredientLine('1-2 onions')
    expect(parsed.measurementStatus).toBe('unresolved')
    expect(parsed.quantityValue).toBe('')
    expect(parsed.name).toBe('onions')
    expect(parsed.quantityText).toBe('1-2')
    expect(parsed.originalText).toBe('1-2 onions')
  })

  it('does not collapse a ranged unit line to the low end', () => {
    const parsed = parseIngredientLine('1-3 tsp salt')
    expect(parsed.measurementStatus).toBe('unresolved')
    expect(parsed.quantityValue).toBe('')
    expect(parsed.name).toBe('salt')
    expect(parsed.quantityText).toBe('1-3 tsp')
  })

  it('still treats count words as piece', () => {
    const parsed = parseIngredientLine('3 cloves garlic')
    expect(parsed).toMatchObject({
      name: 'cloves garlic',
      quantityValue: 3,
      quantityUnit: 'piece',
      measurementStatus: 'known',
    })
  })

  it('leaves unknown units unresolved instead of inventing piece', () => {
    const parsed = parseIngredientLine('2 pinch salt')
    expect(parsed.measurementStatus).toBe('unresolved')
    expect(parsed.quantityUnit).not.toBe('piece')
    expect(parsed.name).toBe('salt')
    expect(parsed.quantityText).toBe('2 pinch')
  })

  it('parses known mass units without a convention prompt', () => {
    const parsed = parseIngredientLine('500 g flour')
    expect(parsed).toMatchObject({
      name: 'flour',
      quantityValue: 500,
      quantityUnit: 'g',
      measurementStatus: 'known',
    })
  })
})
