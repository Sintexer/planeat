import { useLiveQuery } from 'dexie-react-hooks'
import type { SimpleFood } from '../../domain/simpleFoods/SimpleFood'
import { db } from '../../infrastructure/db/database'

export function useSimpleFoods(): SimpleFood[] | undefined {
  return useLiveQuery(() => db.simpleFoods.orderBy('name').toArray(), [])
}
