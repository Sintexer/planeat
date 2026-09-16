import { useLiveQuery } from 'dexie-react-hooks'
import type { Tag } from '../../domain/tags/Tag'
import { db } from '../../infrastructure/db/database'

export function useTags(): Tag[] | undefined {
  return useLiveQuery(() => db.tags.orderBy('name').toArray(), [])
}
