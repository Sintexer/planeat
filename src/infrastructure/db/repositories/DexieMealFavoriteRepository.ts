import type { MealFavoriteRepository } from '../../../application/ports/MealFavoriteRepository'
import type { MealFavorite, MealFavoriteId } from '../../../domain/favorites/MealFavorite'
import type { AppDatabase } from '../database'

export class DexieMealFavoriteRepository implements MealFavoriteRepository {
  private readonly db: AppDatabase

  constructor(db: AppDatabase) {
    this.db = db
  }

  list(): Promise<MealFavorite[]> {
    return this.db.mealFavorites.orderBy('name').toArray()
  }

  getById(id: MealFavoriteId): Promise<MealFavorite | undefined> {
    return this.db.mealFavorites.get(id)
  }

  async findByNameNormalized(name: string): Promise<MealFavorite | undefined> {
    const all = await this.db.mealFavorites.toArray()
    return all.find((f) => f.name.trim().toLowerCase() === name)
  }

  async create(favorite: MealFavorite): Promise<void> {
    await this.db.mealFavorites.add(favorite)
  }

  async delete(id: MealFavoriteId): Promise<void> {
    await this.db.mealFavorites.delete(id)
  }
}
