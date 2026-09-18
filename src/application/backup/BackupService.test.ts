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

function backupFile(
  data: BackupFile['data'] = emptyData(),
  extras: Partial<Pick<BackupFile, 'schemaVersion' | 'exportedAt' | 'format'>> = {},
): BackupFile {
  return {
    format: 'family-menu-planner',
    schemaVersion: CURRENT_BACKUP_FORMAT_VERSION,
    exportedAt: '2026-09-18T12:00:00.000Z',
    data,
    ...extras,
  }
}

class FakeBackupRepository implements BackupRepository {
  replaceAllCalls: BackupFile['data'][] = []
  replaceAllError: Error | null = null

  async exportAll(): Promise<BackupFile['data']> {
    return emptyData()
  }

  async replaceAll(data: BackupFile['data']): Promise<void> {
    if (this.replaceAllError) throw this.replaceAllError
    this.replaceAllCalls.push(data)
  }
}

describe('BackupService.inspectBackup', () => {
  it('summarizes a valid current-version backup', () => {
    const service = new BackupService(new FakeBackupRepository())
    const data = emptyData()
    data.recipes = [
      {
        id: 'recipe-1',
        name: 'Soup',
        yield: { value: 4, unit: 'serving' },
        defaultPortionPerPerson: { value: 1, unit: 'serving' },
        ingredientLines: [],
        instructions: '',
        roles: ['complete'],
        mealTypes: ['dinner'],
        effort: 'regular',
        reusePolicy: 'batch-friendly',
        freezerFriendly: false,
        tagIds: [],
        createdAt: 0,
        updatedAt: 0,
      },
    ]
    data.simpleFoods = [
      {
        id: 'sf-1',
        ingredientId: 'ing-1',
        name: 'Yogurt',
        defaultPortion: { value: 1, unit: 'serving' },
        roles: ['side'],
        mealTypes: ['breakfast'],
        tagIds: [],
        enabledInSuggestions: true,
        createdAt: 0,
        updatedAt: 0,
      },
    ]
    data.plans = [
      {
        id: 'plan-1',
        startDate: '2026-09-14',
        dayCount: 7,
        peopleCount: 2,
        revision: 1,
        preferences: {},
        createdAt: 0,
        updatedAt: 0,
      },
    ]
    data.groceryLists = [
      {
        id: 'list-1',
        title: 'Week',
        status: 'open',
        createdAt: 0,
        updatedAt: 0,
      },
    ]

    const result = service.inspectBackup(backupFile(data))
    expect(result).toEqual({
      ok: true,
      summary: {
        formatSupported: true,
        recipeCount: 1,
        simpleFoodCount: 1,
        planCount: 1,
        groceryListCount: 1,
        exportedAtDisplay: expect.any(String),
      },
    })
    if (result.ok) {
      expect(result.summary.exportedAtDisplay).not.toBeNull()
    }
  })

  it('omits backup date when exportedAt is not a reliable ISO datetime', () => {
    const service = new BackupService(new FakeBackupRepository())
    const result = service.inspectBackup(
      backupFile(emptyData(), { exportedAt: 'sometime last week' }),
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.summary.exportedAtDisplay).toBeNull()
    }
  })

  it('rejects a backup from an older schema version without writing', () => {
    const repo = new FakeBackupRepository()
    const service = new BackupService(repo)
    const result = service.inspectBackup(
      backupFile(emptyData(), { schemaVersion: CURRENT_BACKUP_FORMAT_VERSION - 1 }),
    )
    expect(result).toEqual({
      ok: false,
      error: 'unsupported-version',
      foundVersion: CURRENT_BACKUP_FORMAT_VERSION - 1,
    })
    expect(repo.replaceAllCalls).toHaveLength(0)
  })

  it('reports unsupported-version when format matches but payload is from an older file', () => {
    const service = new BackupService(new FakeBackupRepository())
    const result = service.inspectBackup({
      format: 'family-menu-planner',
      schemaVersion: CURRENT_BACKUP_FORMAT_VERSION - 1,
      exportedAt: '2026-09-18T12:00:00.000Z',
      data: { recipes: [] },
    })
    expect(result).toEqual({
      ok: false,
      error: 'unsupported-version',
      foundVersion: CURRENT_BACKUP_FORMAT_VERSION - 1,
    })
  })

  it('rejects a file with the wrong format', () => {
    const service = new BackupService(new FakeBackupRepository())
    expect(service.inspectBackup({ format: 'other', schemaVersion: 1, data: {} })).toEqual({
      ok: false,
      error: 'invalid',
    })
  })

  it('rejects duplicate recipe ids', () => {
    const service = new BackupService(new FakeBackupRepository())
    const recipe = {
      id: 'recipe-1',
      name: 'Soup',
      yield: { value: 4, unit: 'serving' },
      defaultPortionPerPerson: { value: 1, unit: 'serving' },
      ingredientLines: [],
      instructions: '',
      roles: ['complete' as const],
      mealTypes: ['dinner' as const],
      effort: 'regular' as const,
      reusePolicy: 'batch-friendly' as const,
      freezerFriendly: false,
      tagIds: [],
      createdAt: 0,
      updatedAt: 0,
    }
    const data = emptyData()
    data.recipes = [recipe, { ...recipe }]
    expect(service.inspectBackup(backupFile(data))).toEqual({ ok: false, error: 'invalid' })
  })
})

describe('BackupService.restoreBackup', () => {
  it('accepts a backup at the current schema version and restores the tag catalog', async () => {
    const repo = new FakeBackupRepository()
    const service = new BackupService(repo)
    const data = emptyData()
    data.tags = [{ id: 'tag-1', name: 'batch', createdAt: 0, updatedAt: 0 }]

    const result = await service.restoreBackup(backupFile(data))

    expect(result.ok).toBe(true)
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

    const result = await service.restoreBackup(backupFile(data))

    expect(result.ok).toBe(true)
    expect(repo.replaceAllCalls[0]?.libraryViews).toEqual(data.libraryViews)
  })

  it('fills missing ingredient locale fields on restore', async () => {
    const repo = new FakeBackupRepository()
    const service = new BackupService(repo)
    const data = emptyData()
    data.ingredients = [
      {
        id: 'ing-1',
        name: 'Salt',
        aliases: [],
        isCommon: true,
        createdAt: 0,
        updatedAt: 0,
      },
    ]

    await service.restoreBackup(backupFile(data))

    expect(repo.replaceAllCalls[0]?.ingredients[0]).toEqual({
      id: 'ing-1',
      name: 'Salt',
      aliases: [],
      isCommon: true,
      createdAt: 0,
      updatedAt: 0,
      preferredLabels: [],
      localizedAliases: [],
    })
  })

  it('rejects a backup from an older schema version (no migration chain exists)', async () => {
    const repo = new FakeBackupRepository()
    const service = new BackupService(repo)

    const result = await service.restoreBackup(
      backupFile(emptyData(), { schemaVersion: CURRENT_BACKUP_FORMAT_VERSION - 1 }),
    )
    expect(result).toEqual({
      ok: false,
      error: 'unsupported-version',
      foundVersion: CURRENT_BACKUP_FORMAT_VERSION - 1,
    })
    expect(repo.replaceAllCalls).toHaveLength(0)
  })

  it('does not write when the file is not a valid backup', async () => {
    const repo = new FakeBackupRepository()
    const service = new BackupService(repo)
    const result = await service.restoreBackup({ not: 'a backup' })
    expect(result).toEqual({ ok: false, error: 'invalid' })
    expect(repo.replaceAllCalls).toHaveLength(0)
  })

  it('returns write-failed without treating the call as success when replaceAll throws', async () => {
    const repo = new FakeBackupRepository()
    repo.replaceAllError = new Error('disk full')
    const service = new BackupService(repo)
    const result = await service.restoreBackup(backupFile())
    expect(result).toEqual({ ok: false, error: 'write-failed' })
  })
})
