import type { Recipe } from '../recipes/Recipe'
import type { Settings } from './Settings'

export interface BackupFile {
  format: 'family-menu-planner'
  schemaVersion: number
  exportedAt: string
  data: {
    recipes: Recipe[]
    settings: Settings[]
  }
}
