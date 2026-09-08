import type { BackupRepository } from '../../../application/ports/BackupRepository'
import type { BackupFile } from '../../../domain/shared/Backup'
import { DEFAULT_SETTINGS } from '../../../domain/shared/Settings'
import type { AppDatabase } from '../database'

export class DexieBackupRepository implements BackupRepository {
  private readonly db: AppDatabase

  constructor(db: AppDatabase) {
    this.db = db
  }

  async exportAll(): Promise<BackupFile['data']> {
    const [recipes, settings] = await Promise.all([
      this.db.recipes.toArray(),
      this.db.settings.toArray(),
    ])
    return { recipes, settings }
  }

  async replaceAll(data: BackupFile['data']): Promise<void> {
    await this.db.transaction('rw', this.db.recipes, this.db.settings, async () => {
      await this.db.recipes.clear()
      await this.db.settings.clear()
      await this.db.recipes.bulkAdd(data.recipes)
      await this.db.settings.bulkAdd(data.settings.length > 0 ? data.settings : [DEFAULT_SETTINGS])
    })
  }
}
