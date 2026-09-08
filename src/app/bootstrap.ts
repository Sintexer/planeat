import { BackupService } from '../application/backup/BackupService'
import { RecipeService } from '../application/recipes/RecipeService'
import type { SettingsRepository } from '../application/ports/SettingsRepository'
import { db } from '../infrastructure/db/database'
import { DexieBackupRepository } from '../infrastructure/db/repositories/DexieBackupRepository'
import { DexieRecipeRepository } from '../infrastructure/db/repositories/DexieRecipeRepository'
import { DexieSettingsRepository } from '../infrastructure/db/repositories/DexieSettingsRepository'

export interface AppServices {
  recipeService: RecipeService
  settingsRepository: SettingsRepository
  backupService: BackupService
}

export function bootstrap(): AppServices {
  const recipeRepository = new DexieRecipeRepository(db)
  const settingsRepository = new DexieSettingsRepository(db)
  const backupRepository = new DexieBackupRepository(db)

  return {
    recipeService: new RecipeService(recipeRepository),
    settingsRepository,
    backupService: new BackupService(backupRepository),
  }
}
