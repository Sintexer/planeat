import { BackupService } from '../application/backup/BackupService'
import { MealFavoriteService } from '../application/favorites/MealFavoriteService'
import { GroceryService } from '../application/groceries/GroceryService'
import { PairingService } from '../application/pairings/PairingService'
import { IngredientService } from '../application/ingredients/IngredientService'
import { LibraryViewService } from '../application/libraryViews/LibraryViewService'
import { GenerationService } from '../application/plans/GenerationService'
import { createWorkerGenerationRunner } from '../application/plans/generationRunner'
import { PlanService } from '../application/plans/PlanService'
import { QuantityService } from '../application/quantities/QuantityService'
import { RecipeImportService } from '../application/recipes/RecipeImportService'
import { RecipeService } from '../application/recipes/RecipeService'
import { SimpleFoodService } from '../application/simpleFoods/SimpleFoodService'
import { TagService } from '../application/tags/TagService'
import type { SettingsRepository } from '../application/ports/SettingsRepository'
import { db } from '../infrastructure/db/database'
import { SchemaOrgRecipeExtractor } from '../infrastructure/importers/extractRecipes'
import { DexieBackupRepository } from '../infrastructure/db/repositories/DexieBackupRepository'
import { DexieGroceryRepository } from '../infrastructure/db/repositories/DexieGroceryRepository'
import { DexieIngredientRepository } from '../infrastructure/db/repositories/DexieIngredientRepository'
import { DexieLibraryViewRepository } from '../infrastructure/db/repositories/DexieLibraryViewRepository'
import { DexieMealFavoriteRepository } from '../infrastructure/db/repositories/DexieMealFavoriteRepository'
import { DexiePairingRepository } from '../infrastructure/db/repositories/DexiePairingRepository'
import { DexiePlanRepository } from '../infrastructure/db/repositories/DexiePlanRepository'
import { DexieRecipeRepository } from '../infrastructure/db/repositories/DexieRecipeRepository'
import { DexieSettingsRepository } from '../infrastructure/db/repositories/DexieSettingsRepository'
import { DexieSimpleFoodRepository } from '../infrastructure/db/repositories/DexieSimpleFoodRepository'
import { DexieTagRepository } from '../infrastructure/db/repositories/DexieTagRepository'
import { seedStarterLibraryIfEmpty } from '../infrastructure/db/seed/seedStarterLibrary'

export interface AppServices {
  recipeService: RecipeService
  ingredientService: IngredientService
  simpleFoodService: SimpleFoodService
  tagService: TagService
  planService: PlanService
  generationService: GenerationService
  groceryService: GroceryService
  quantityService: QuantityService
  mealFavoriteService: MealFavoriteService
  pairingService: PairingService
  recipeImportService: RecipeImportService
  settingsRepository: SettingsRepository
  libraryViewService: LibraryViewService
  backupService: BackupService
}

export function bootstrap(): AppServices {
  const recipeRepository = new DexieRecipeRepository(db)
  const ingredientRepository = new DexieIngredientRepository(db)
  const simpleFoodRepository = new DexieSimpleFoodRepository(db)
  const tagRepository = new DexieTagRepository(db)
  const planRepository = new DexiePlanRepository(db)
  const groceryRepository = new DexieGroceryRepository(db)
  const mealFavoriteRepository = new DexieMealFavoriteRepository(db)
  const pairingRepository = new DexiePairingRepository(db)
  const settingsRepository = new DexieSettingsRepository(db)
  const libraryViewRepository = new DexieLibraryViewRepository(db)
  const backupRepository = new DexieBackupRepository(db)
  const quantityService = new QuantityService()

  // Ensure the singleton settings row exists for live queries.
  void settingsRepository.get()
  // First launch (empty recipe library) gets a small editable starter set.
  void seedStarterLibraryIfEmpty(db)

  const planService = new PlanService(
    planRepository,
    recipeRepository,
    simpleFoodRepository,
    settingsRepository,
    quantityService,
    tagRepository,
  )

  return {
    recipeService: new RecipeService(recipeRepository),
    ingredientService: new IngredientService(ingredientRepository),
    simpleFoodService: new SimpleFoodService(simpleFoodRepository),
    tagService: new TagService(tagRepository),
    planService,
    generationService: new GenerationService(
      planRepository,
      recipeRepository,
      quantityService,
      planService,
      createWorkerGenerationRunner(
        new Worker(new URL('../infrastructure/planning/generationWorker.ts', import.meta.url), {
          type: 'module',
        }),
      ),
      settingsRepository,
      simpleFoodRepository,
      tagRepository,
      ingredientRepository,
    ),
    groceryService: new GroceryService(
      groceryRepository,
      planRepository,
      ingredientRepository,
      simpleFoodRepository,
      quantityService,
      recipeRepository,
    ),
    quantityService,
    mealFavoriteService: new MealFavoriteService(mealFavoriteRepository),
    pairingService: new PairingService(pairingRepository),
    recipeImportService: new RecipeImportService(new SchemaOrgRecipeExtractor()),
    settingsRepository,
    libraryViewService: new LibraryViewService(libraryViewRepository),
    backupService: new BackupService(backupRepository),
  }
}
