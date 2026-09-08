import type { BackupFile } from '../../domain/shared/Backup'

export interface BackupRepository {
  exportAll(): Promise<BackupFile['data']>
  replaceAll(data: BackupFile['data']): Promise<void>
}
