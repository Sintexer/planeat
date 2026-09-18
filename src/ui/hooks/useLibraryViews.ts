import { useLiveQuery } from 'dexie-react-hooks'
import type { LibraryView } from '../../domain/libraryViews/LibraryView'
import { db } from '../../infrastructure/db/database'

export function useLibraryViews(): LibraryView[] | undefined {
  return useLiveQuery(() => db.libraryViews.orderBy('name').toArray(), [])
}
