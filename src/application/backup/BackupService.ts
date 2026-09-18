import { CURRENT_BACKUP_FORMAT_VERSION } from '../../domain/shared/BackupFormatVersion'
import type { BackupFile } from '../../domain/shared/Backup'
import { mergeIngredientDefaults } from '../../domain/ingredients/Ingredient'
import { mergeSettingsDefaults } from '../../domain/shared/Settings'
import type { BackupRepository } from '../ports/BackupRepository'
import { backupFileSchema } from './backupSchema'

export type BackupRestoreError = 'invalid' | 'unsupported-version' | 'write-failed'

export interface BackupRestoreSummary {
  formatSupported: true
  recipeCount: number
  simpleFoodCount: number
  planCount: number
  groceryListCount: number
  exportedAtDisplay: string | null
}

export type BackupRestoreResult =
  | { ok: true; summary: BackupRestoreSummary }
  | { ok: false; error: BackupRestoreError; foundVersion?: number }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function reliableExportedAtDisplay(exportedAt: string, locale = 'en'): string | null {
  if (!/^\d{4}-\d{2}-\d{2}(T[\d:.+-Z]+)?$/.test(exportedAt)) return null
  const parsed = Date.parse(exportedAt)
  if (Number.isNaN(parsed)) return null
  const date = new Date(parsed)
  if (exportedAt.includes('T')) {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
  }
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date)
}

function summaryFromBackup(
  backup: {
    exportedAt: string
    data: {
      recipes: { length: number }
      simpleFoods: { length: number }
      plans: { length: number }
      groceryLists: { length: number }
    }
  },
  locale = 'en',
): BackupRestoreSummary {
  return {
    formatSupported: true,
    recipeCount: backup.data.recipes.length,
    simpleFoodCount: backup.data.simpleFoods.length,
    planCount: backup.data.plans.length,
    groceryListCount: backup.data.groceryLists.length,
    exportedAtDisplay: reliableExportedAtDisplay(backup.exportedAt, locale),
  }
}

function inspectRaw(raw: unknown, locale = 'en'): BackupRestoreResult {
  const parsed = backupFileSchema.safeParse(raw)
  if (parsed.success) {
    if (parsed.data.schemaVersion !== CURRENT_BACKUP_FORMAT_VERSION) {
      return {
        ok: false,
        error: 'unsupported-version',
        foundVersion: parsed.data.schemaVersion,
      }
    }
    return { ok: true, summary: summaryFromBackup(parsed.data, locale) }
  }

  if (
    isRecord(raw) &&
    raw.format === 'family-menu-planner' &&
    typeof raw.schemaVersion === 'number'
  ) {
    if (raw.schemaVersion !== CURRENT_BACKUP_FORMAT_VERSION) {
      return {
        ok: false,
        error: 'unsupported-version',
        foundVersion: raw.schemaVersion,
      }
    }
  }

  return { ok: false, error: 'invalid' }
}

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

  inspectBackup(raw: unknown, locale = 'en'): BackupRestoreResult {
    return inspectRaw(raw, locale)
  }

  async restoreBackup(raw: unknown, locale = 'en'): Promise<BackupRestoreResult> {
    const inspected = inspectRaw(raw, locale)
    if (!inspected.ok) return inspected

    const parsed = backupFileSchema.safeParse(raw)
    if (!parsed.success) return { ok: false, error: 'invalid' }

    try {
      await this.backupRepository.replaceAll({
        ...parsed.data.data,
        settings: parsed.data.data.settings.map((row) => mergeSettingsDefaults(row)),
        ingredients: parsed.data.data.ingredients.map((row) => mergeIngredientDefaults(row)),
      })
    } catch {
      return { ok: false, error: 'write-failed' }
    }

    return inspected
  }
}
