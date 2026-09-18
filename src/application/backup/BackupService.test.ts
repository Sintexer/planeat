import { describe, expect, it } from 'vitest'
import { BackupService } from './BackupService'
import { CURRENT_BACKUP_FORMAT_VERSION } from '../../domain/shared/BackupFormatVersion'
import type { BackupFile } from '../../domain/shared/Backup'
import type { BackupRepository } from '../ports/BackupRepository'

function emptyData(): BackupFile['data'] {
  return {
    recipes: [],
    settings: [],
    ingredients: [],
    simpleFoods: [],
    plans: [],
    mealSlots: [],
    mealComponents: [],
    cookingEvents: [],
    prepSessions: [],
    groceryLists: [],
    groceryItems: [],
    mealFavorites: [],
    recipePairings: [],
    tags: [],
    libraryViews: [],
  }
}

class FakeBackupRepository implements BackupRepository {
  replaceAllCalls: BackupFile['data'][] = []

  async exportAll(): Promise<BackupFile['data']> {
    return emptyData()
  }

  async replaceAll(data: BackupFile['data']): Promise<void> {
    this.replaceAllCalls.push(data)
  }
}

describe('BackupService.restoreBackup', () => {
  it('accepts a backup at the current schema version and restores the tag catalog', async () => {
    const repo = new FakeBackupRepository()
    const service = new BackupService(repo)
    const data = emptyData()
    data.tags = [{ id: 'tag-1', name: 'batch', createdAt: 0, updatedAt: 0 }]

    await service.restoreBackup({
      format: 'family-menu-planner',
      schemaVersion: CURRENT_BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    })

    expect(repo.replaceAllCalls).toHaveLength(1)
    expect(repo.replaceAllCalls[0]?.tags).toEqual(data.tags)
  })

  it('restores saved library views', async () => {
    const repo = new FakeBackupRepository()
    const service = new BackupService(repo)
    const data = emptyData()
    data.libraryViews = [
      {
        id: 'view-1',
        name: 'Kids lunch',
        criteria: {
          query: 'kids',
          kind: 'all',
          mealTypes: ['lunch'],
          roles: [],
          effort: 'all',
          tagIds: ['tag-1'],
          maxTotalTimeMinutes: '',
          containsIngredientIds: [],
          excludeIngredientIds: [],
          sort: 'name',
          group: 'none',
        },
        createdAt: 0,
        updatedAt: 0,
      },
    ]

    await service.restoreBackup({
      format: 'family-menu-planner',
      schemaVersion: CURRENT_BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    })

    expect(repo.replaceAllCalls[0]?.libraryViews).toEqual(data.libraryViews)
  })

  it('rejects a backup from an older schema version (no migration chain exists)', async () => {
    const repo = new FakeBackupRepository()
    const service = new BackupService(repo)

    await expect(
      service.restoreBackup({
        format: 'family-menu-planner',
        schemaVersion: CURRENT_BACKUP_FORMAT_VERSION - 1,
        exportedAt: new Date().toISOString(),
        data: emptyData(),
      }),
    ).rejects.toThrow(/Unsupported backup schema version/)
    expect(repo.replaceAllCalls).toHaveLength(0)
  })
})
