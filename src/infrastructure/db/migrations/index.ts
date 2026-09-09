import type Dexie from 'dexie'
import type { Recipe } from '../../../domain/recipes/Recipe'
import { DEFAULT_SETTINGS } from '../../../domain/shared/Settings'

type LegacyRecipeV1 = {
  id: string
  name: string
  servings: number
  createdAt: number
  updatedAt: number
}

function isLegacyRecipeV1(value: unknown): value is LegacyRecipeV1 {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.servings === 'number' &&
    record.yield === undefined &&
    typeof record.name === 'string'
  )
}

export function migrateLegacyRecipeV1(legacy: LegacyRecipeV1): Recipe {
  return {
    id: legacy.id,
    name: legacy.name,
    yield: { value: legacy.servings, unit: 'serving' },
    defaultPortionPerPerson: { value: 1, unit: 'serving' },
    ingredientLines: [],
    instructions: '',
    roles: ['complete'],
    mealTypes: ['dinner'],
    effort: 'regular',
    reusePolicy: 'fresh-only',
    freezerFriendly: false,
    tags: [],
    createdAt: legacy.createdAt,
    updatedAt: legacy.updatedAt,
  }
}

/**
 * Each version is applied additively — never edit a shipped version's schema,
 * only append a new `.version(n)` block, so existing local data survives upgrades.
 */
export function applyMigrations(dexie: Dexie): void {
  dexie.version(1).stores({
    recipes: 'id, name',
    settings: 'id',
  })

  dexie
    .version(2)
    .stores({
      recipes: 'id, name',
      settings: 'id',
      ingredients: 'id, name',
      simpleFoods: 'id, name, ingredientId',
    })
    .upgrade(async (tx) => {
      const table = tx.table('recipes')
      const rows = await table.toArray()
      for (const row of rows) {
        if (isLegacyRecipeV1(row)) {
          await table.put(migrateLegacyRecipeV1(row))
        }
      }
    })

  dexie
    .version(3)
    .stores({
      recipes: 'id, name',
      settings: 'id',
      ingredients: 'id, name',
      simpleFoods: 'id, name, ingredientId',
      plans: 'id, startDate',
      mealSlots: 'id, planId, [planId+date+mealType]',
      mealComponents: 'id, slotId',
      cookingEvents: 'id, planId',
    })
    .upgrade(async (tx) => {
      const settingsTable = tx.table('settings')
      const rows = await settingsTable.toArray()
      for (const row of rows) {
        const record = row as Record<string, unknown>
        if (typeof record.weekStartDay !== 'number') {
          await settingsTable.put({
            ...row,
            weekStartDay: DEFAULT_SETTINGS.weekStartDay,
          })
        }
      }
    })

  dexie.version(4).stores({
    recipes: 'id, name',
    settings: 'id',
    ingredients: 'id, name',
    simpleFoods: 'id, name, ingredientId',
    plans: 'id, startDate',
    mealSlots: 'id, planId, [planId+date+mealType]',
    mealComponents: 'id, slotId',
    cookingEvents: 'id, planId',
    groceryLists: 'id, status, sourcePlanId',
    groceryItems: 'id, listId',
  })
}
