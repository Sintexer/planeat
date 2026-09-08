import type { Recipe, RecipeId } from '../../domain/recipes/Recipe'

export interface RecipeRepository {
  create(input: Pick<Recipe, 'name' | 'servings'>): Promise<Recipe>
  getAll(): Promise<Recipe[]>
  getById(id: RecipeId): Promise<Recipe | undefined>
  update(id: RecipeId, changes: Partial<Pick<Recipe, 'name' | 'servings'>>): Promise<void>
  remove(id: RecipeId): Promise<void>
}
