import Dexie, { type EntityTable } from 'dexie'
import type { Recipe } from '../../domain/recipes/Recipe'
import type { Settings } from '../../domain/shared/Settings'
import { applyMigrations } from './migrations'

export class AppDatabase extends Dexie {
  recipes!: EntityTable<Recipe, 'id'>
  settings!: EntityTable<Settings, 'id'>

  constructor() {
    super('planeat')
    applyMigrations(this)
  }
}

export const db = new AppDatabase()
