import { useLiveQuery } from 'dexie-react-hooks'
import type { RecipePairing } from '../../domain/pairings/RecipePairing'
import { db } from '../../infrastructure/db/database'

export function usePairings(): RecipePairing[] | undefined {
  return useLiveQuery(() => db.recipePairings.toArray(), [])
}
