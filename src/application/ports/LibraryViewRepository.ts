import type {
  LibraryView,
  LibraryViewCriteria,
  LibraryViewId,
} from '../../domain/libraryViews/LibraryView'

export type CreateLibraryViewInput = {
  name: string
  criteria: LibraryViewCriteria
}

export type UpdateLibraryViewInput = Partial<Pick<LibraryView, 'name' | 'criteria'>>

export interface LibraryViewRepository {
  create(input: CreateLibraryViewInput): Promise<LibraryView>
  getAll(): Promise<LibraryView[]>
  getById(id: LibraryViewId): Promise<LibraryView | undefined>
  findByName(name: string): Promise<LibraryView | undefined>
  update(id: LibraryViewId, changes: UpdateLibraryViewInput): Promise<void>
  delete(id: LibraryViewId): Promise<void>
}
