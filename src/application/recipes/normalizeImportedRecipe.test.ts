import { describe, expect, it } from 'vitest'
import { normalizeImportedRecipe } from './normalizeImportedRecipe'

describe('normalizeImportedRecipe — measurement review', () => {
  it('hints that cups need confirmation and leaves the unit unspecified', () => {
    const result = normalizeImportedRecipe({
      '@type': 'Recipe',
      name: 'Pancakes',
      recipeIngredient: ['2 cups flour', '500 g milk'],
    })
    const flour = result.form.ingredientLines.find((line) => line.name === 'flour')
    expect(flour?.quantityValue).toBe(2)
    expect(flour?.quantityUnit).toBe('cup')
    expect(flour?.measurementStatus).toBe('ambiguous-cup')
    expect(flour?.originalText).toBe('2 cups flour')
    expect(result.hints.some((hint) => hint.includes('cup'))).toBe(true)
    expect(result.hints.some((hint) => hint.includes('unspecified'))).toBe(true)
  })

  it('hints unresolved lines and does not invent a quantity', () => {
    const result = normalizeImportedRecipe({
      '@type': 'Recipe',
      name: 'Seasoning',
      recipeIngredient: ['salt to taste', '1-2 onions'],
    })
    expect(
      result.form.ingredientLines.every((line) => line.measurementStatus === 'unresolved'),
    ).toBe(true)
    expect(result.form.ingredientLines.every((line) => line.quantityValue === '')).toBe(true)
    expect(result.hints.some((hint) => hint.includes('could not be resolved'))).toBe(true)
  })

  it('keeps yield cups as unspecified cup, not a US/metric convention', () => {
    const result = normalizeImportedRecipe({
      '@type': 'Recipe',
      name: 'Batter',
      recipeYield: '4 cups',
      recipeIngredient: ['1 cup flour'],
    })
    expect(result.form.yieldUnit).toBe('cup')
    expect(result.form.yieldValue).toBe(4)
  })

  it('does not treat servings as grams', () => {
    const result = normalizeImportedRecipe({
      '@type': 'Recipe',
      name: 'Soup',
      recipeYield: '4 servings',
      recipeIngredient: ['1 g salt'],
    })
    expect(result.form.yieldUnit).toBe('serving')
    expect(result.form.yieldValue).toBe(4)
  })

  it('hints that imported names can stay unlinked without teaching aliases', () => {
    const result = normalizeImportedRecipe({
      '@type': 'Recipe',
      name: 'Pancakes',
      recipeIngredient: ['2 cups flour'],
    })
    expect(result.hints.some((hint) => hint.includes('unlinked'))).toBe(true)
    expect(result.hints.some((hint) => hint.includes('aliases'))).toBe(true)
  })
})
