import type Dexie from 'dexie'

/**
 * Each version is applied additively — never edit a shipped version's schema,
 * only append a new `.version(n)` block, so existing local data survives upgrades.
 */
export function applyMigrations(dexie: Dexie): void {
  dexie.version(1).stores({
    recipes: 'id, name',
    settings: 'id',
  })
}
