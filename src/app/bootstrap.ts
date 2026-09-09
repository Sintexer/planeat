import { BackupService } from '../application/backup/BackupService'
import { GroceryService } from '../application/groceries/GroceryService'
import { IngredientService } from '../application/ingredients/IngredientService'
import { PlanService } from '../application/plans/PlanService'
import { QuantityService } from '../application/quantities/QuantityService'
import { RecipeService } from '../application/recipes/RecipeService'
import { SimpleFoodService } from '../application/simpleFoods/SimpleFoodService'
import type { SettingsRepository } from '../application/ports/SettingsRepository'
import { db } from '../infrastructure/db/database'
import { DexieBackupRepository } from '../infrastructure/db/repositories/DexieBackupRepository'
import { DexieGroceryRepository } from '../infrastructure/db/repositories/DexieGroceryRepository'
import { DexieIngredientRepository } from '../infrastructure/db/repositories/DexieIngredientRepository'
import { DexiePlanRepository } from '../infrastructure/db/repositories/DexiePlanRepository'
import { DexieRecipeRepository } from '../infrastructure/db/repositories/DexieRecipeRepository'
import { DexieSettingsRepository } from '../infrastructure/db/repositories/DexieSettingsRepository'
import { DexieSimpleFoodRepository } from '../infrastructure/db/repositories/DexieSimpleFoodRepository'
import { seedStarterLibraryIfEmpty } from '../infrastructure/db/seed/seedStarterLibrary'

export interface AppServices {
  recipeService: RecipeService
  ingredientService: IngredientService
  simpleFoodService: SimpleFoodService
  planService: PlanService
  groceryService: GroceryService
  quantityService: QuantityService
  settingsRepository: SettingsRepository
  backupService: BackupService
}

export function bootstrap(): AppServices {
  const recipeRepository = new DexieRecipeRepository(db)
  const ingredientRepository = new DexieIngredientRepository(db)
  const simpleFoodRepository = new DexieSimpleFoodRepository(db)
  const planRepository = new DexiePlanRepository(db)
  const groceryRepository = new DexieGroceryRepository(db)
  const settingsRepository = new DexieSettingsRepository(db)
  const backupRepository = new DexieBackupRepository(db)
  const quantityService = new QuantityService()

  // Ensure the singleton settings row exists for live queries.
  void settingsRepository.get()
  // First launch (empty recipe library) gets a small editable starter set.
  void seedStarterLibraryIfEmpty(db)

  return {
    recipeService: new RecipeService(recipeRepository),
    ingredientService: new IngredientService(ingredientRepository),
    simpleFoodService: new SimpleFoodService(simpleFoodRepository),
    planService: new PlanService(
      planRepository,
      recipeRepository,
      simpleFoodRepository,
      settingsRepository,
      quantityService,
    ),
    groceryService: new GroceryService(
      groceryRepository,
      planRepository,
      ingredientRepository,
      simpleFoodRepository,
      quantityService,
    ),
    quantityService,
    settingsRepository,
    backupService: new BackupService(backupRepository),
  }
}
