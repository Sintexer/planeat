import { describe, expect, it } from 'vitest'
import { backupFileSchema } from './backupSchema'
import { CURRENT_BACKUP_FORMAT_VERSION } from '../../domain/shared/BackupFormatVersion'
import type { BackupFile } from '../../domain/shared/Backup'
import type { Recipe } from '../../domain/recipes/Recipe'
import type { RecipeSnapshot } from '../../domain/plans/CookingEvent'
import { DEFAULT_SETTINGS } from '../../domain/shared/Settings'

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
    libraryViews: [],
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

  it('round-trips archived on a tag and still accepts tags that omit the field', () => {
    const data = emptyData()
    data.tags = [
      { id: 'tag-1', name: 'batch', archived: true, createdAt: 0, updatedAt: 0 },
      { id: 'tag-2', name: 'soup', createdAt: 0, updatedAt: 0 },
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
    expect(result.data.data.tags[0]?.archived).toBe(true)
    expect(result.data.data.tags[1]?.archived).toBeUndefined()
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

describe('backupFileSchema — grocery item sources (Sprint 24)', () => {
  it('round-trips contribution sources, including an unrecognized meal type', () => {
    const data = emptyData()
    data.groceryLists = [
      { id: 'list-1', title: 'Shop', status: 'open', createdAt: 0, updatedAt: 0 },
    ]
    data.groceryItems = [
      {
        id: 'item-1',
        listId: 'list-1',
        label: 'Rice',
        ingredientId: 'rice',
        quantity: { value: 1500, unit: 'g' },
        checked: false,
        origin: 'generated',
        quantityManuallyEdited: false,
        sources: [
          {
            kind: 'cooking-event',
            dishName: 'Curry',
            quantity: { value: 500, unit: 'g' },
            meals: [{ slotId: 'slot-1', date: '2026-01-06', mealType: 'dinner' }],
          },
          {
            kind: 'simple-food',
            dishName: 'Yogurt',
            quantity: { value: 1, unit: 'serving' },
            meals: [{ slotId: 'slot-2', date: '2026-01-07', mealType: 'elevenses' }],
          },
        ],
      },
    ]

    const result = backupFileSchema.safeParse({
      format: 'family-menu-planner',
      schemaVersion: CURRENT_BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.data.groceryItems[0]?.sources?.[1]?.meals[0]?.mealType).toBe('elevenses')
  })
})

describe('backupFileSchema — saved library views (Sprint 22)', () => {
  it('round-trips a named view with query, tag filters, sort, and grouping', () => {
    const data = emptyData()
    data.libraryViews = [
      {
        id: 'view-1',
        name: 'Kids lunch',
        criteria: {
          query: 'kids',
          kind: 'recipe',
          mealTypes: ['lunch'],
          roles: [],
          effort: 'all',
          tagIds: ['tag-kids'],
          maxTotalTimeMinutes: 30,
          containsIngredientIds: [],
          excludeIngredientIds: [],
          sort: 'name',
          group: 'kind',
        },
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
    if (!result.success) return
    expect(result.data.data.libraryViews[0]?.name).toBe('Kids lunch')
    expect(result.data.data.libraryViews[0]?.criteria.tagIds).toEqual(['tag-kids'])
  })

  it('defaults omitted cleanup on a saved view and round-trips an explicit cleanup kind', () => {
    const data = emptyData()
    data.libraryViews = [
      {
        id: 'view-1',
        name: 'Kids lunch',
        criteria: {
          query: '',
          kind: 'all',
          mealTypes: [],
          roles: [],
          effort: 'all',
          tagIds: [],
          maxTotalTimeMinutes: '',
          containsIngredientIds: [],
          excludeIngredientIds: [],
          sort: 'relevance',
          group: 'none',
        },
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
    const omitted = backupFileSchema.safeParse(JSON.parse(JSON.stringify(file)))
    expect(omitted.success).toBe(true)
    if (!omitted.success) return
    expect(omitted.data.data.libraryViews[0]?.criteria.cleanup).toBe('')

    data.libraryViews[0] = {
      ...data.libraryViews[0]!,
      criteria: { ...data.libraryViews[0]!.criteria, cleanup: 'missing-time' },
    }
    const withCleanup = backupFileSchema.safeParse(JSON.parse(JSON.stringify({ ...file, data })))
    expect(withCleanup.success).toBe(true)
    if (!withCleanup.success) return
    expect(withCleanup.data.data.libraryViews[0]?.criteria.cleanup).toBe('missing-time')
  })

  it('rejects duplicate library-view ids', () => {
    const data = emptyData()
    const view = {
      id: 'view-1',
      name: 'A',
      criteria: {
        query: '',
        kind: 'all' as const,
        mealTypes: [],
        roles: [],
        effort: 'all' as const,
        tagIds: [],
        maxTotalTimeMinutes: '' as const,
        containsIngredientIds: [],
        excludeIngredientIds: [],
        sort: 'relevance' as const,
        group: 'none' as const,
      },
      createdAt: 0,
      updatedAt: 0,
    }
    data.libraryViews = [view, { ...view, name: 'B' }]

    const result = backupFileSchema.safeParse({
      format: 'family-menu-planner',
      schemaVersion: CURRENT_BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    })
    expect(result.success).toBe(false)
  })

  it('accepts settings.uiLocale ru', () => {
    const data = emptyData()
    data.settings = [
      {
        ...DEFAULT_SETTINGS,
        uiLocale: 'ru',
        measurementPreference: 'as-entered',
        catalogSort: 'name',
        catalogGroup: 'none',
        householdSize: 2,
        weekStartDay: 1,
        maxBatchPrepUnits: 4,
        preferredBatchPrepDays: [0],
        quickMealsOnlyDays: [],
        avoidMultipleDemandingPreps: true,
        favorVegetablesDaily: true,
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

  it('accepts generationHardPolicy with catalog ids that are not in the file', () => {
    const data = emptyData()
    data.settings = [
      {
        ...DEFAULT_SETTINGS,
        generationHardPolicy: {
          unknownTimePolicy: 'allow',
          unknownIngredientPolicy: 'exclude',
          excludedRecipeIds: ['gone-recipe'],
          requiredTagIds: ['gone-tag'],
          excludedTagIds: [],
          includeIngredientIds: [],
          excludeIngredientIds: ['gone-ing'],
          maxTotalTimeMinutes: 45,
        },
      },
    ]
    const result = backupFileSchema.safeParse({
      format: 'family-menu-planner',
      schemaVersion: CURRENT_BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.data.settings[0].generationHardPolicy?.excludedRecipeIds).toEqual([
      'gone-recipe',
    ])
  })

  it('accepts optional generationSearchBudget on settings', () => {
    const data = emptyData()
    data.settings = [
      {
        ...DEFAULT_SETTINGS,
        generationSearchBudget: {
          beamWidth: 4,
          expansionBudget: 50,
          perSlotCandidateLimit: 3,
        },
      },
    ]
    const result = backupFileSchema.safeParse({
      format: 'family-menu-planner',
      schemaVersion: CURRENT_BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.data.settings[0].generationSearchBudget).toEqual({
      beamWidth: 4,
      expansionBudget: 50,
      perSlotCandidateLimit: 3,
    })
  })

  it('accepts optional generationCompositionBounds on settings', () => {
    const data = emptyData()
    data.settings = [
      {
        ...DEFAULT_SETTINGS,
        generationCompositionBounds: {
          maxPairingsPerRecipe: 1,
          maxComponentsPerCandidate: 3,
        },
      },
    ]
    const result = backupFileSchema.safeParse({
      format: 'family-menu-planner',
      schemaVersion: CURRENT_BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.data.settings[0].generationCompositionBounds).toEqual({
      maxPairingsPerRecipe: 1,
      maxComponentsPerCandidate: 3,
    })
  })

  it('accepts optional generationBatchPolicy on settings', () => {
    const data = emptyData()
    data.settings = [
      {
        ...DEFAULT_SETTINGS,
        generationBatchPolicy: {
          maxExtraPlannedUses: 1,
          unallocatedProduction: 'allow-with-warning',
        },
      },
    ]
    const result = backupFileSchema.safeParse({
      format: 'family-menu-planner',
      schemaVersion: CURRENT_BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.data.settings[0].generationBatchPolicy).toEqual({
      maxExtraPlannedUses: 1,
      unallocatedProduction: 'allow-with-warning',
    })
  })
})
