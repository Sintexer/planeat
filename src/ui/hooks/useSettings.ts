import { useLiveQuery } from 'dexie-react-hooks'
import type { Settings } from '../../domain/shared/Settings'
import { db } from '../../infrastructure/db/database'

export function useSettings(): Settings | undefined {
  return useLiveQuery(() => db.settings.get('app-settings'), [])
}
