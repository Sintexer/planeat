import type { Recipe, RecipeId, RecipeWriteInput } from '../../domain/recipes/Recipe'

export interface RecipeRepository {
  create(input: RecipeWriteInput): Promise<Recipe>
  getAll(): Promise<Recipe[]>
  getById(id: RecipeId): Promise<Recipe | undefined>
  update(id: RecipeId, changes: Partial<RecipeWriteInput>): Promise<void>
  remove(id: RecipeId): Promise<void>
}
