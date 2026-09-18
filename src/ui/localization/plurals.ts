export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other'

export type PluralForms = Partial<Record<PluralCategory, string>> & { other: string }

export const enPlurals = {
  'filter.showItems': {
    one: 'Show {count} item',
    other: 'Show {count} items',
  },
  'catalog.selected': {
    one: '{count} selected',
    other: '{count} selected',
  },
  'import.ingredientLines': {
    one: '{count} ingredient line',
    other: '{count} ingredient lines',
  },
  'tags.recipeCount': {
    one: '{count} recipe',
    other: '{count} recipes',
  },
  'tags.foodCount': {
    one: '{count} simple food',
    other: '{count} simple foods',
  },
} as const satisfies Record<string, PluralForms>

export type PluralId = keyof typeof enPlurals
