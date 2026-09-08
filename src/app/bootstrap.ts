import { RecipeService } from '../application/recipes/RecipeService'
import { db } from '../infrastructure/db/database'
import { DexieRecipeRepository } from '../infrastructure/db/repositories/DexieRecipeRepository'
import { DexieSettingsRepository } from '../infrastructure/db/repositories/DexieSettingsRepository'

export interface AppServices {
  recipeService: RecipeService
  settingsRepository: DexieSettingsRepository
}

export function bootstrap(): AppServices {
  const recipeRepository = new DexieRecipeRepository(db)
  const settingsRepository = new DexieSettingsRepository(db)

  return {
    recipeService: new RecipeService(recipeRepository),
    settingsRepository,
  }
}
