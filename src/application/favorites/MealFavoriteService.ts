import type {
  FavoriteComponent,
  MealFavorite,
  MealFavoriteId,
} from '../../domain/favorites/MealFavorite'
import type { FavoriteError, MealFavoriteRepository } from '../ports/MealFavoriteRepository'

function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

export class MealFavoriteService {
  private readonly favorites: MealFavoriteRepository

  constructor(favorites: MealFavoriteRepository) {
    this.favorites = favorites
  }

  list(): Promise<MealFavorite[]> {
    return this.favorites.list()
  }

  async create(
    name: string,
    components: FavoriteComponent[],
  ): Promise<{ ok: true; favorite: MealFavorite } | { ok: false; error: FavoriteError }> {
    const trimmed = name.trim()
    if (!trimmed) return { ok: false, error: 'empty-name' }
    if (components.length === 0) return { ok: false, error: 'empty-components' }

    const existing = await this.favorites.findByNameNormalized(normalizeName(trimmed))
    if (existing) return { ok: false, error: 'duplicate-name' }

    const now = Date.now()
    const favorite: MealFavorite = {
      id: crypto.randomUUID(),
      name: trimmed,
      components,
      createdAt: now,
      updatedAt: now,
    }
    await this.favorites.create(favorite)
    return { ok: true, favorite }
  }

  async delete(id: MealFavoriteId): Promise<{ ok: true } | { ok: false; error: FavoriteError }> {
    const existing = await this.favorites.getById(id)
    if (!existing) return { ok: false, error: 'not-found' }
    await this.favorites.delete(id)
    return { ok: true }
  }
}
