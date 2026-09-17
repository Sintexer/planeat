import type { LibraryView, LibraryViewId } from '../../../domain/libraryViews/LibraryView'
import type {
  CreateLibraryViewInput,
  LibraryViewRepository,
  UpdateLibraryViewInput,
} from '../../../application/ports/LibraryViewRepository'
import type { AppDatabase } from '../database'

export class DexieLibraryViewRepository implements LibraryViewRepository {
  private readonly db: AppDatabase

  constructor(db: AppDatabase) {
    this.db = db
  }

  async create(input: CreateLibraryViewInput): Promise<LibraryView> {
    const now = Date.now()
    const view: LibraryView = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      criteria: input.criteria,
      createdAt: now,
      updatedAt: now,
    }
    await this.db.libraryViews.add(view)
    return view
  }

  async getAll(): Promise<LibraryView[]> {
    return this.db.libraryViews.orderBy('name').toArray()
  }

  async getById(id: LibraryViewId): Promise<LibraryView | undefined> {
    return this.db.libraryViews.get(id)
  }

  async findByName(name: string): Promise<LibraryView | undefined> {
    const needle = name.trim().toLowerCase()
    const all = await this.db.libraryViews.toArray()
    return all.find((view) => view.name.trim().toLowerCase() === needle)
  }

  async update(id: LibraryViewId, changes: UpdateLibraryViewInput): Promise<void> {
    await this.db.libraryViews.update(id, { ...changes, updatedAt: Date.now() })
  }

  async delete(id: LibraryViewId): Promise<void> {
    await this.db.libraryViews.delete(id)
  }
}
