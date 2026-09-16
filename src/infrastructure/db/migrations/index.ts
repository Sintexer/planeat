import type Dexie from 'dexie'
import type { Recipe } from '../../../domain/recipes/Recipe'
import { DEFAULT_SETTINGS, mergeSettingsDefaults } from '../../../domain/shared/Settings'

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
    tagIds: [],
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

  dexie
    .version(5)
    .stores({
      recipes: 'id, name',
      settings: 'id',
      ingredients: 'id, name',
      simpleFoods: 'id, name, ingredientId',
      plans: 'id, startDate',
      mealSlots: 'id, planId, [planId+date+mealType]',
      mealComponents: 'id, slotId',
      cookingEvents: 'id, planId, sessionId',
      prepSessions: 'id, planId, [planId+date]',
      groceryLists: 'id, status, sourcePlanId',
      groceryItems: 'id, listId',
      mealFavorites: 'id, name',
      recipePairings: 'id, recipeId',
    })
    .upgrade(async (tx) => {
      const settingsTable = tx.table('settings')
      for (const row of await settingsTable.toArray()) {
        const record = row as Record<string, unknown>
        if (record.id !== 'app-settings') continue
        await settingsTable.put(
          mergeSettingsDefaults(record as Parameters<typeof mergeSettingsDefaults>[0]),
        )
      }

      const eventsTable = tx.table('cookingEvents')
      const sessionsTable = tx.table('prepSessions')
      const events = await eventsTable.toArray()
      const sessionByKey = new Map<string, string>()

      for (const event of events) {
        const record = event as Record<string, unknown>
        const planId = String(record.planId)
        const scheduledDate = String(record.scheduledDate)
        const key = `${planId}|${scheduledDate}`
        let sessionId = sessionByKey.get(key)
        if (!sessionId) {
          sessionId = crypto.randomUUID()
          sessionByKey.set(key, sessionId)
          await sessionsTable.put({
            id: sessionId,
            planId,
            date: scheduledDate,
            time: null,
            label: null,
          })
        }
        await eventsTable.put({ ...record, sessionId })
      }
    })

  dexie
    .version(6)
    .stores({
      recipes: 'id, name',
      settings: 'id',
      ingredients: 'id, name',
      simpleFoods: 'id, name, ingredientId',
      plans: 'id, startDate',
      mealSlots: 'id, planId, [planId+date+mealType]',
      mealComponents: 'id, slotId',
      cookingEvents: 'id, planId, sessionId',
      prepSessions: 'id, planId, [planId+date]',
      groceryLists: 'id, status, sourcePlanId',
      groceryItems: 'id, listId',
      mealFavorites: 'id, name',
      recipePairings: 'id, recipeId',
      tags: 'id, name',
    })
    .upgrade(async (tx) => {
      const tagsTable = tx.table('tags')
      const idByNormalizedName = new Map<string, string>()

      async function resolveTagId(rawName: string): Promise<string | null> {
        const trimmed = rawName.trim()
        if (!trimmed) return null
        const key = trimmed.toLowerCase()
        const existing = idByNormalizedName.get(key)
        if (existing) return existing
        const id = crypto.randomUUID()
        idByNormalizedName.set(key, id)
        const now = Date.now()
        await tagsTable.put({ id, name: trimmed, createdAt: now, updatedAt: now })
        return id
      }

      // cookingEvents.recipeSnapshot.tags are frozen historical labels — left untouched.
      for (const tableName of ['recipes', 'simpleFoods']) {
        const table = tx.table(tableName)
        for (const row of await table.toArray()) {
          const record = row as Record<string, unknown>
          const legacyTags = Array.isArray(record.tags) ? (record.tags as string[]) : []
          const tagIds: string[] = []
          for (const rawName of legacyTags) {
            const id = await resolveTagId(rawName)
            if (id) tagIds.push(id)
          }
          delete record.tags
          await table.put({ ...record, tagIds })
        }
      }
    })
}
