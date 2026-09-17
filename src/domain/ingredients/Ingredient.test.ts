import { describe, expect, it } from 'vitest'
import {
  ingredientMatchesAnyIdentifier,
  ingredientMatchesName,
  mergeIngredientDefaults,
  resolveIngredientLabel,
  type Ingredient,
} from './Ingredient'

function baseIngredient(overrides: Partial<Ingredient> = {}): Ingredient {
  return {
    id: 'ing-1',
    name: 'Eggplant',
    aliases: [],
    isCommon: false,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('resolveIngredientLabel', () => {
  it('falls back to name when there are no preferred labels', () => {
    expect(resolveIngredientLabel(baseIngredient(), 'en')).toBe('Eggplant')
  })

  it('returns the matching-locale preferred label when present', () => {
    const ingredient = baseIngredient({ preferredLabels: [{ locale: 'en', label: 'Aubergine' }] })
    expect(resolveIngredientLabel(ingredient, 'en')).toBe('Aubergine')
  })

  it('falls back to name when no label matches the requested locale', () => {
    const ingredient = baseIngredient({ preferredLabels: [{ locale: 'en', label: 'Aubergine' }] })
    // Cast simulates a locale not in the current UI_LOCALES, matching a future/foreign value.
    expect(resolveIngredientLabel(ingredient, 'xx' as never)).toBe('Eggplant')
  })
})

describe('ingredientMatchesName', () => {
  const ingredient = baseIngredient({
    aliases: ['aubergine'],
    localizedAliases: [{ locale: 'en', text: 'guinea squash' }],
    preferredLabels: [{ locale: 'en', label: 'Melongene' }],
  })

  it('matches the canonical name', () => {
    expect(ingredientMatchesName(ingredient, 'eggplant')).toBe(true)
  })

  it('matches a legacy alias, case/whitespace-insensitively', () => {
    expect(ingredientMatchesName(ingredient, '  Aubergine  ')).toBe(true)
  })

  it('matches a localized alias', () => {
    expect(ingredientMatchesName(ingredient, 'guinea squash')).toBe(true)
  })

  it('does not match a preferred label', () => {
    expect(ingredientMatchesName(ingredient, 'melongene')).toBe(false)
  })

  it('does not match an unrelated term', () => {
    expect(ingredientMatchesName(ingredient, 'carrot')).toBe(false)
  })
})

describe('ingredientMatchesAnyIdentifier', () => {
  const ingredient = baseIngredient({
    preferredLabels: [{ locale: 'en', label: 'Melongene' }],
  })

  it('matches everything ingredientMatchesName matches', () => {
    expect(ingredientMatchesAnyIdentifier(ingredient, 'eggplant')).toBe(true)
  })

  it('also matches a preferred label', () => {
    expect(ingredientMatchesAnyIdentifier(ingredient, 'melongene')).toBe(true)
  })

  it('does not match an unrelated term', () => {
    expect(ingredientMatchesAnyIdentifier(ingredient, 'carrot')).toBe(false)
  })
})

describe('mergeIngredientDefaults', () => {
  it('defaults missing preferredLabels/localizedAliases to empty arrays', () => {
    const row = baseIngredient()
    expect(mergeIngredientDefaults(row)).toEqual({
      ...row,
      preferredLabels: [],
      localizedAliases: [],
    })
  })

  it('leaves populated fields unchanged', () => {
    const row = baseIngredient({
      preferredLabels: [{ locale: 'en', label: 'Aubergine' }],
      localizedAliases: [{ locale: 'en', text: 'guinea squash' }],
    })
    expect(mergeIngredientDefaults(row)).toEqual(row)
  })
})
