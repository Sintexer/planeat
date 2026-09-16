import type { GroceryItem } from '../groceries/GroceryItem'
import type { GroceryList } from '../groceries/GroceryList'
import type { MealFavorite } from '../favorites/MealFavorite'
import type { RecipePairing } from '../pairings/RecipePairing'
import type { CookingEvent } from '../plans/CookingEvent'
import type { MealComponent } from '../plans/MealComponent'
import type { MealSlot } from '../plans/MealSlot'
import type { Plan } from '../plans/Plan'
import type { PrepSession } from '../plans/PrepSession'
import type { Ingredient } from '../ingredients/Ingredient'
import type { Recipe } from '../recipes/Recipe'
import type { SimpleFood } from '../simpleFoods/SimpleFood'
import type { Tag } from '../tags/Tag'
import type { Settings } from './Settings'

export interface BackupFile {
  format: 'family-menu-planner'
  schemaVersion: number
  exportedAt: string
  data: {
    recipes: Recipe[]
    settings: Settings[]
    ingredients: Ingredient[]
    simpleFoods: SimpleFood[]
    plans: Plan[]
    mealSlots: MealSlot[]
    mealComponents: MealComponent[]
    cookingEvents: CookingEvent[]
    prepSessions: PrepSession[]
    groceryLists: GroceryList[]
    groceryItems: GroceryItem[]
    mealFavorites: MealFavorite[]
    recipePairings: RecipePairing[]
    tags: Tag[]
  }
}
