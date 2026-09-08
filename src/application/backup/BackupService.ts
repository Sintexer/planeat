import { CURRENT_BACKUP_FORMAT_VERSION } from '../../domain/shared/BackupFormatVersion'
import type { BackupFile } from '../../domain/shared/Backup'
import type { BackupRepository } from '../ports/BackupRepository'
import { backupFileSchema } from './backupSchema'

export class BackupService {
  private readonly backupRepository: BackupRepository

  constructor(backupRepository: BackupRepository) {
    this.backupRepository = backupRepository
  }

  async createBackup(): Promise<BackupFile> {
    const data = await this.backupRepository.exportAll()
    return {
      format: 'family-menu-planner',
      schemaVersion: CURRENT_BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    }
  }

  async restoreBackup(raw: unknown): Promise<void> {
    const parsed = backupFileSchema.parse(raw)

    if (parsed.schemaVersion !== CURRENT_BACKUP_FORMAT_VERSION) {
      throw new Error(`Unsupported backup schema version: ${parsed.schemaVersion}`)
    }

    try {
      await this.backupRepository.replaceAll(parsed.data)
    } catch {
      throw new Error('Could not restore backup: local data was not modified.')
    }
  }
}
