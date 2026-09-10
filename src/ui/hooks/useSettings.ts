import { useLiveQuery } from 'dexie-react-hooks'
import { mergeSettingsDefaults, type Settings } from '../../domain/shared/Settings'
import { db } from '../../infrastructure/db/database'

export function useSettings(): Settings | undefined {
  return useLiveQuery(async () => {
    const row = await db.settings.get('app-settings')
    if (!row) return undefined
    return mergeSettingsDefaults(row)
  }, [])
}
