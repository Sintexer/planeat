import { CURRENT_BACKUP_FORMAT_VERSION } from '../../domain/shared/BackupFormatVersion'
import type { BackupFile } from '../../domain/shared/Backup'
import { mergeIngredientDefaults } from '../../domain/ingredients/Ingredient'
import { mergeSettingsDefaults } from '../../domain/shared/Settings'
import {
  mergeGenerationHardPolicy,
  missingGenerationPolicyRefs,
} from '../../domain/plans/generation/constraints'
import { mergeGenerationConfig } from '../../domain/plans/generation/GenerationConfig'
import type { BackupRepository } from '../ports/BackupRepository'
import { backupFileSchema } from './backupSchema'

export type BackupRestoreError = 'invalid' | 'unsupported-version' | 'write-failed'

export type MissingGenerationRefCounts = {
  recipeCount: number
  tagCount: number
  ingredientCount: number
}

export interface BackupRestoreSummary {
  formatSupported: true
  recipeCount: number
  simpleFoodCount: number
  planCount: number
  groceryListCount: number
  exportedAtDisplay: string | null
  missingGenerationRefs?: MissingGenerationRefCounts
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

function missingGenerationRefsFromBackup(data: {
  settings: { generationHardPolicy?: unknown; generationPreferredTagIds?: unknown }[]
  generationPresets?: { config?: unknown }[]
  recipes: { id: string }[]
  tags: { id: string }[]
  ingredients: { id: string }[]
}): MissingGenerationRefCounts | undefined {
  const recipeIds = data.recipes.map((row) => row.id)
  const tagIds = data.tags.map((row) => row.id)
  const ingredientIds = data.ingredients.map((row) => row.id)
  let recipeCount = 0
  let tagCount = 0
  let ingredientCount = 0
  for (const row of data.settings) {
    const policy = mergeGenerationHardPolicy(
      row.generationHardPolicy as Parameters<typeof mergeGenerationHardPolicy>[0],
    )
    const preferred = Array.isArray(row.generationPreferredTagIds)
      ? row.generationPreferredTagIds.filter((id): id is string => typeof id === 'string')
      : []
    const missing = missingGenerationPolicyRefs(
      policy,
      { recipeIds, tagIds, ingredientIds },
      preferred,
    )
    recipeCount += missing.recipeIds.length
    tagCount += missing.tagIds.length
    ingredientCount += missing.ingredientIds.length
  }
  for (const preset of data.generationPresets ?? []) {
    const config = mergeGenerationConfig(
      preset.config as Parameters<typeof mergeGenerationConfig>[0],
    )
    const missing = missingGenerationPolicyRefs(
      config.generationHardPolicy,
      { recipeIds, tagIds, ingredientIds },
      config.generationPreferredTagIds,
    )
    recipeCount += missing.recipeIds.length
    tagCount += missing.tagIds.length
    ingredientCount += missing.ingredientIds.length
  }
  if (recipeCount === 0 && tagCount === 0 && ingredientCount === 0) return undefined
  return { recipeCount, tagCount, ingredientCount }
}

function summaryFromBackup(
  backup: {
    exportedAt: string
    data: {
      recipes: { id: string }[]
      simpleFoods: { length: number }
      plans: { length: number }
      groceryLists: { length: number }
      settings: { generationHardPolicy?: unknown }[]
      tags: { id: string }[]
      ingredients: { id: string }[]
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
    missingGenerationRefs: missingGenerationRefsFromBackup(backup.data),
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
        generationPresets: parsed.data.data.generationPresets.map((row) => ({
          ...row,
          config: mergeGenerationConfig(row.config),
        })),
      })
    } catch {
      return { ok: false, error: 'write-failed' }
    }

    return inspected
  }
}
