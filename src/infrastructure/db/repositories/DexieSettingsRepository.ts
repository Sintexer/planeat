import type { SettingsRepository } from '../../../application/ports/SettingsRepository'
import { DEFAULT_SETTINGS, type Settings } from '../../../domain/shared/Settings'
import type { AppDatabase } from '../database'

export class DexieSettingsRepository implements SettingsRepository {
  private readonly db: AppDatabase

  constructor(db: AppDatabase) {
    this.db = db
  }

  async get(): Promise<Settings> {
    const existing = await this.db.settings.get(DEFAULT_SETTINGS.id)
    if (existing) {
      if (typeof (existing as Settings).weekStartDay !== 'number') {
        const merged: Settings = {
          ...DEFAULT_SETTINGS,
          ...existing,
          weekStartDay: DEFAULT_SETTINGS.weekStartDay,
        }
        await this.db.settings.put(merged)
        return merged
      }
      return existing
    }
    await this.db.settings.put(DEFAULT_SETTINGS)
    return DEFAULT_SETTINGS
  }

  async update(changes: Partial<Omit<Settings, 'id'>>): Promise<void> {
    await this.get()
    await this.db.settings.update(DEFAULT_SETTINGS.id, changes)
  }
}
