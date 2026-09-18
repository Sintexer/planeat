import {
  type LibraryView,
  type LibraryViewCriteria,
  type LibraryViewId,
} from '../../domain/libraryViews/LibraryView'
import type { LibraryViewRepository } from '../ports/LibraryViewRepository'

export type LibraryViewError = 'empty-name' | 'name-collision' | 'not-found'

function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

export class LibraryViewService {
  private readonly views: LibraryViewRepository

  constructor(views: LibraryViewRepository) {
    this.views = views
  }

  list(): Promise<LibraryView[]> {
    return this.views.getAll()
  }

  async create(
    rawName: string,
    criteria: LibraryViewCriteria,
  ): Promise<{ ok: true; view: LibraryView } | { ok: false; error: LibraryViewError }> {
    const name = rawName.trim()
    if (!name) return { ok: false, error: 'empty-name' }
    const existing = await this.views.findByName(name)
    if (existing) return { ok: false, error: 'name-collision' }
    const view = await this.views.create({ name, criteria })
    return { ok: true, view }
  }

  async rename(
    id: LibraryViewId,
    rawName: string,
  ): Promise<{ ok: true } | { ok: false; error: LibraryViewError }> {
    const current = await this.views.getById(id)
    if (!current) return { ok: false, error: 'not-found' }
    const name = rawName.trim()
    if (!name) return { ok: false, error: 'empty-name' }
    const all = await this.views.getAll()
    const conflict = all.find(
      (view) => view.id !== id && normalizeName(view.name) === normalizeName(name),
    )
    if (conflict) return { ok: false, error: 'name-collision' }
    await this.views.update(id, { name })
    return { ok: true }
  }

  async updateCriteria(
    id: LibraryViewId,
    criteria: LibraryViewCriteria,
  ): Promise<{ ok: true } | { ok: false; error: LibraryViewError }> {
    const current = await this.views.getById(id)
    if (!current) return { ok: false, error: 'not-found' }
    await this.views.update(id, { criteria })
    return { ok: true }
  }

  async delete(id: LibraryViewId): Promise<{ ok: true } | { ok: false; error: LibraryViewError }> {
    const current = await this.views.getById(id)
    if (!current) return { ok: false, error: 'not-found' }
    await this.views.delete(id)
    return { ok: true }
  }
}
