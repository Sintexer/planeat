import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../infrastructure/db/database'
import type { Settings } from '../../domain/shared/Settings'

export function useSettings(): Settings | undefined {
  return useLiveQuery(() => db.settings.get('app-settings'), [])
}
