import type { GroceryItem } from '../../domain/groceries/GroceryItem'
import type { GroceryList } from '../../domain/groceries/GroceryList'
import type { MealFavorite } from '../../domain/favorites/MealFavorite'
import type { RecipePairing } from '../../domain/pairings/RecipePairing'
import type { CookingEvent } from '../../domain/plans/CookingEvent'
import type { MealComponent } from '../../domain/plans/MealComponent'
import type { MealSlot } from '../../domain/plans/MealSlot'
import type { Plan } from '../../domain/plans/Plan'
import type { PrepSession } from '../../domain/plans/PrepSession'
import type { Ingredient } from '../../domain/ingredients/Ingredient'
import type { Recipe } from '../../domain/recipes/Recipe'
import type { Settings } from '../../domain/shared/Settings'
import type { SimpleFood } from '../../domain/simpleFoods/SimpleFood'
import type { Tag } from '../../domain/tags/Tag'
import { applyMigrations } from './migrations'
import Dexie, { type EntityTable } from 'dexie'

export class AppDatabase extends Dexie {
  recipes!: EntityTable<Recipe, 'id'>
  settings!: EntityTable<Settings, 'id'>
  ingredients!: EntityTable<Ingredient, 'id'>
  simpleFoods!: EntityTable<SimpleFood, 'id'>
  plans!: EntityTable<Plan, 'id'>
  mealSlots!: EntityTable<MealSlot, 'id'>
  mealComponents!: EntityTable<MealComponent, 'id'>
  cookingEvents!: EntityTable<CookingEvent, 'id'>
  prepSessions!: EntityTable<PrepSession, 'id'>
  groceryLists!: EntityTable<GroceryList, 'id'>
  groceryItems!: EntityTable<GroceryItem, 'id'>
  mealFavorites!: EntityTable<MealFavorite, 'id'>
  recipePairings!: EntityTable<RecipePairing, 'id'>
  tags!: EntityTable<Tag, 'id'>

  constructor() {
    super('planeat')
    applyMigrations(this)
  }
}

export const db = new AppDatabase()
