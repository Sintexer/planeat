import type { MealFavorite, MealFavoriteId } from '../../domain/favorites/MealFavorite'
import type { FavoriteComponent } from '../../domain/favorites/MealFavorite'

export type FavoriteError = 'empty-name' | 'empty-components' | 'duplicate-name' | 'not-found'

export interface MealFavoriteRepository {
  list(): Promise<MealFavorite[]>
  getById(id: MealFavoriteId): Promise<MealFavorite | undefined>
  findByNameNormalized(name: string): Promise<MealFavorite | undefined>
  create(favorite: MealFavorite): Promise<void>
  delete(id: MealFavoriteId): Promise<void>
}

export type { FavoriteComponent }
