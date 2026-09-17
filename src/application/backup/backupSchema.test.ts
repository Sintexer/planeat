import { describe, expect, it } from 'vitest'
import { backupFileSchema } from './backupSchema'
import { CURRENT_BACKUP_FORMAT_VERSION } from '../../domain/shared/BackupFormatVersion'
import type { BackupFile } from '../../domain/shared/Backup'
import type { Recipe } from '../../domain/recipes/Recipe'
import type { RecipeSnapshot } from '../../domain/plans/CookingEvent'

function emptyData(): BackupFile['data'] {
  return {
    recipes: [],
    settings: [],
    ingredients: [],
    simpleFoods: [],
    plans: [],
    mealSlots: [],
    mealComponents: [],
    cookingEvents: [],
    prepSessions: [],
    groceryLists: [],
    groceryItems: [],
    mealFavorites: [],
    recipePairings: [],
    tags: [],
  }
}

function baseRecipe(): Recipe {
  return {
    id: 'recipe-1',
    name: 'Soup',
    yield: { value: 4, unit: 'serving' },
    defaultPortionPerPerson: { value: 1, unit: 'serving' },
    ingredientLines: [],
    instructions: '',
    roles: ['complete'],
    mealTypes: ['dinner'],
    effort: 'regular',
    reusePolicy: 'batch-friendly',
    freezerFriendly: false,
    tagIds: ['tag-1'],
    createdAt: 0,
    updatedAt: 0,
  }
}

function baseRecipeSnapshot(): RecipeSnapshot {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { tagIds, ...rest } = baseRecipe()
  return { ...rest, tags: ['soup', 'vegetable'] }
}

describe('backupFileSchema — tag catalog + tagIds shape', () => {
  it('accepts a current-version backup with a tag catalog and tagIds assignments', () => {
    const data = emptyData()
    data.tags = [{ id: 'tag-1', name: 'soup', createdAt: 0, updatedAt: 0 }]
    data.recipes = [baseRecipe()]

    const result = backupFileSchema.safeParse({
      format: 'family-menu-planner',
      schemaVersion: CURRENT_BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a cookingEvents.recipeSnapshot with frozen label strings (not tagIds)', () => {
    const data = emptyData()
    data.cookingEvents = [
      {
        id: 'event-1',
        planId: 'plan-1',
        sessionId: 'session-1',
        recipeId: 'recipe-1',
        // Snapshot uses `tags: string[]` (frozen labels) — no `tagIds` field at all.
        recipeSnapshot: baseRecipeSnapshot(),
        outputQuantity: { value: 4, unit: 'serving' },
        scheduledDate: '2026-01-01',
      },
    ]

    const result = backupFileSchema.safeParse({
      format: 'family-menu-planner',
      schemaVersion: CURRENT_BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    })
    expect(result.success).toBe(true)
  })

  it('round-trips a dishType value outside the curated Select list (lenient string, not an enum)', () => {
    const data = emptyData()
    data.recipes = [{ ...baseRecipe(), dishType: 'some-future-or-legacy-value' }]

    const result = backupFileSchema.safeParse({
      format: 'family-menu-planner',
      schemaVersion: CURRENT_BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.data.recipes[0]?.dishType).toBe('some-future-or-legacy-value')
    }
  })

  it('rejects duplicate tag ids', () => {
    const data = emptyData()
    data.tags = [
      { id: 'tag-1', name: 'soup', createdAt: 0, updatedAt: 0 },
      { id: 'tag-1', name: 'vegetable', createdAt: 0, updatedAt: 0 },
    ]

    const result = backupFileSchema.safeParse({
      format: 'family-menu-planner',
      schemaVersion: CURRENT_BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    })
    expect(result.success).toBe(false)
  })
})

describe('backupFileSchema — ingredient line quantity shapes (Sprint 12)', () => {
  function roundTrip(recipe: Recipe) {
    const data = emptyData()
    data.recipes = [recipe]
    const file = {
      format: 'family-menu-planner',
      schemaVersion: CURRENT_BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    }
    return backupFileSchema.safeParse(JSON.parse(JSON.stringify(file)))
  }

  it('round-trips a non-numeric quantityText line', () => {
    const result = roundTrip({
      ...baseRecipe(),
      ingredientLines: [
        { ingredientId: 'ing-1', quantity: null, quantityText: 'to taste', displayText: 'Salt' },
      ],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.data.recipes[0]?.ingredientLines[0]?.quantityText).toBe('to taste')
      expect(result.data.data.recipes[0]?.ingredientLines[0]?.quantity).toBeNull()
    }
  })

  it('round-trips imported sourceText on an ingredient line', () => {
    const result = roundTrip({
      ...baseRecipe(),
      ingredientLines: [
        {
          ingredientId: 'ing-1',
          quantity: { value: 2, unit: 'cup' },
          displayText: 'Flour',
          sourceText: '2 cups flour',
        },
      ],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.data.recipes[0]?.ingredientLines[0]?.sourceText).toBe('2 cups flour')
      expect(result.data.data.recipes[0]?.ingredientLines[0]?.quantity?.unit).toBe('cup')
    }
  })

  it('round-trips an unlinked imported line without ingredientId', () => {
    const result = roundTrip({
      ...baseRecipe(),
      ingredientLines: [
        {
          quantity: { value: 2, unit: 'cup' },
          displayText: 'flour',
          sourceText: '2 cups flour',
        },
      ],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      const line = result.data.data.recipes[0]?.ingredientLines[0]
      expect(line?.ingredientId).toBeUndefined()
      expect(line?.displayText).toBe('flour')
      expect(line?.sourceText).toBe('2 cups flour')
    }
  })

  it('round-trips a bare legacy unit (e.g. "cup") unchanged, without inventing a convention', () => {
    const result = roundTrip({
      ...baseRecipe(),
      ingredientLines: [
        {
          ingredientId: 'ing-1',
          quantity: { value: 1, unit: 'cup' },
          displayText: 'Flour',
        },
      ],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.data.recipes[0]?.ingredientLines[0]?.quantity).toEqual({
        value: 1,
        unit: 'cup',
      })
    }
  })

  it('keeps explicit US and metric cup units distinct after a round-trip', () => {
    const result = roundTrip({
      ...baseRecipe(),
      ingredientLines: [
        { ingredientId: 'ing-1', quantity: { value: 1, unit: 'cup-us' }, displayText: 'Flour' },
        { ingredientId: 'ing-2', quantity: { value: 1, unit: 'cup-metric' }, displayText: 'Milk' },
      ],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      const lines = result.data.data.recipes[0]?.ingredientLines ?? []
      expect(lines[0]?.quantity?.unit).toBe('cup-us')
      expect(lines[1]?.quantity?.unit).toBe('cup-metric')
      expect(lines[0]?.quantity?.unit).not.toBe(lines[1]?.quantity?.unit)
    }
  })
})

describe('backupFileSchema — ingredient preferredLabels/localizedAliases (Sprint 15)', () => {
  it('round-trips a locale value outside the current UI_LOCALES list unchanged', () => {
    const data = emptyData()
    data.ingredients = [
      {
        id: 'ing-1',
        name: 'Eggplant',
        aliases: ['aubergine'],
        preferredLabels: [{ locale: 'xx-unknown', label: 'Foo' }],
        localizedAliases: [{ locale: 'xx-unknown', text: 'bar' }],
        isCommon: false,
        createdAt: 0,
        updatedAt: 0,
      },
    ]

    const file = {
      format: 'family-menu-planner',
      schemaVersion: CURRENT_BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    }
    const result = backupFileSchema.safeParse(JSON.parse(JSON.stringify(file)))
    expect(result.success).toBe(true)
    if (result.success) {
      const ingredient = result.data.data.ingredients[0]
      expect(ingredient?.preferredLabels).toEqual([{ locale: 'xx-unknown', label: 'Foo' }])
      expect(ingredient?.localizedAliases).toEqual([{ locale: 'xx-unknown', text: 'bar' }])
    }
  })

  it('accepts an old-shape ingredient with neither new field present', () => {
    const data = emptyData()
    data.ingredients = [
      {
        id: 'ing-1',
        name: 'Eggplant',
        aliases: ['aubergine'],
        isCommon: false,
        createdAt: 0,
        updatedAt: 0,
      },
    ]

    const result = backupFileSchema.safeParse({
      format: 'family-menu-planner',
      schemaVersion: CURRENT_BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    })
    expect(result.success).toBe(true)
  })
})

describe('backupFileSchema — shopping sections (Sprint 20)', () => {
  it('round-trips shoppingSection on ingredients and grocery items, including unknown keys', () => {
    const data = emptyData()
    data.ingredients = [
      {
        id: 'ing-1',
        name: 'Carrot',
        aliases: [],
        shoppingSection: 'produce',
        isCommon: false,
        createdAt: 0,
        updatedAt: 0,
      },
    ]
    data.groceryLists = [
      {
        id: 'list-1',
        title: 'Shop',
        status: 'open',
        createdAt: 0,
        updatedAt: 0,
      },
    ]
    data.groceryItems = [
      {
        id: 'item-1',
        listId: 'list-1',
        label: 'Carrot',
        ingredientId: 'ing-1',
        quantity: { value: 3, unit: 'piece' },
        checked: false,
        origin: 'generated',
        quantityManuallyEdited: false,
        shoppingSection: 'produce',
      },
      {
        id: 'item-2',
        listId: 'list-1',
        label: 'Tape',
        quantity: null,
        checked: false,
        origin: 'manual',
        quantityManuallyEdited: false,
        shoppingSection: 'aisle-9',
      },
    ]

    const file = {
      format: 'family-menu-planner',
      schemaVersion: CURRENT_BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    }
    const result = backupFileSchema.safeParse(JSON.parse(JSON.stringify(file)))
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.data.ingredients[0]?.shoppingSection).toBe('produce')
    expect(result.data.data.groceryItems[0]?.shoppingSection).toBe('produce')
    expect(result.data.data.groceryItems[1]?.shoppingSection).toBe('aisle-9')
  })

  it('accepts grocery items and ingredients with no shoppingSection', () => {
    const data = emptyData()
    data.groceryLists = [
      { id: 'list-1', title: 'Shop', status: 'open', createdAt: 0, updatedAt: 0 },
    ]
    data.groceryItems = [
      {
        id: 'item-1',
        listId: 'list-1',
        label: 'Salt',
        quantity: null,
        checked: true,
        origin: 'generated',
        quantityManuallyEdited: false,
      },
    ]

    const result = backupFileSchema.safeParse({
      format: 'family-menu-planner',
      schemaVersion: CURRENT_BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    })
    expect(result.success).toBe(true)
  })
})
