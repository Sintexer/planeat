import { BackupService } from '../application/backup/BackupService'
import { IngredientService } from '../application/ingredients/IngredientService'
import { QuantityService } from '../application/quantities/QuantityService'
import { RecipeService } from '../application/recipes/RecipeService'
import { SimpleFoodService } from '../application/simpleFoods/SimpleFoodService'
import type { SettingsRepository } from '../application/ports/SettingsRepository'
import { db } from '../infrastructure/db/database'
import { DexieBackupRepository } from '../infrastructure/db/repositories/DexieBackupRepository'
import { DexieIngredientRepository } from '../infrastructure/db/repositories/DexieIngredientRepository'
import { DexieRecipeRepository } from '../infrastructure/db/repositories/DexieRecipeRepository'
import { DexieSettingsRepository } from '../infrastructure/db/repositories/DexieSettingsRepository'
import { DexieSimpleFoodRepository } from '../infrastructure/db/repositories/DexieSimpleFoodRepository'

export interface AppServices {
  recipeService: RecipeService
  ingredientService: IngredientService
  simpleFoodService: SimpleFoodService
  quantityService: QuantityService
  settingsRepository: SettingsRepository
  backupService: BackupService
}

export function bootstrap(): AppServices {
  const recipeRepository = new DexieRecipeRepository(db)
  const ingredientRepository = new DexieIngredientRepository(db)
  const simpleFoodRepository = new DexieSimpleFoodRepository(db)
  const settingsRepository = new DexieSettingsRepository(db)
  const backupRepository = new DexieBackupRepository(db)

  // Ensure the singleton settings row exists for live queries.
  void settingsRepository.get()

  return {
    recipeService: new RecipeService(recipeRepository),
    ingredientService: new IngredientService(ingredientRepository),
    simpleFoodService: new SimpleFoodService(simpleFoodRepository),
    quantityService: new QuantityService(),
    settingsRepository,
    backupService: new BackupService(backupRepository),
  }
}
