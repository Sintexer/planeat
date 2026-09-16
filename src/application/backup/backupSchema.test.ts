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
