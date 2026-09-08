import type { RecipeRepository } from '../../../application/ports/RecipeRepository'
import type { Recipe, RecipeId, RecipeWriteInput } from '../../../domain/recipes/Recipe'
import type { AppDatabase } from '../database'

export class DexieRecipeRepository implements RecipeRepository {
  private readonly db: AppDatabase

  constructor(db: AppDatabase) {
    this.db = db
  }

  async create(input: RecipeWriteInput): Promise<Recipe> {
    const now = Date.now()
    const recipe: Recipe = {
      id: crypto.randomUUID(),
      ...input,
      createdAt: now,
      updatedAt: now,
    }
    await this.db.recipes.add(recipe)
    return recipe
  }

  async getAll(): Promise<Recipe[]> {
    return this.db.recipes.orderBy('name').toArray()
  }

  async getById(id: RecipeId): Promise<Recipe | undefined> {
    return this.db.recipes.get(id)
  }

  async update(id: RecipeId, changes: Partial<RecipeWriteInput>): Promise<void> {
    await this.db.recipes.update(id, { ...changes, updatedAt: Date.now() })
  }

  async remove(id: RecipeId): Promise<void> {
    await this.db.recipes.delete(id)
  }
}
