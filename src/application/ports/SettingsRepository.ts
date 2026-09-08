import type { Settings } from '../../domain/shared/Settings'

export interface SettingsRepository {
  get(): Promise<Settings>
  update(changes: Partial<Omit<Settings, 'id'>>): Promise<void>
}
