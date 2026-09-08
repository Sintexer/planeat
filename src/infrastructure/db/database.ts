import Dexie, { type EntityTable } from 'dexie'
import type { Ingredient } from '../../domain/ingredients/Ingredient'
import type { Recipe } from '../../domain/recipes/Recipe'
import type { Settings } from '../../domain/shared/Settings'
import type { SimpleFood } from '../../domain/simpleFoods/SimpleFood'
import { applyMigrations } from './migrations'

export class AppDatabase extends Dexie {
  recipes!: EntityTable<Recipe, 'id'>
  settings!: EntityTable<Settings, 'id'>
  ingredients!: EntityTable<Ingredient, 'id'>
  simpleFoods!: EntityTable<SimpleFood, 'id'>

  constructor() {
    super('planeat')
    applyMigrations(this)
  }
}

export const db = new AppDatabase()
