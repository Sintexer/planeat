import type { RecipeRepository } from '../ports/RecipeRepository'
import type { Recipe } from '../../domain/recipes/Recipe'

export class RecipeService {
  private readonly recipes: RecipeRepository

  constructor(recipes: RecipeRepository) {
    this.recipes = recipes
  }

  createRecipe(input: Pick<Recipe, 'name' | 'servings'>): Promise<Recipe> {
    return this.recipes.create(input)
  }

  listRecipes(): Promise<Recipe[]> {
    return this.recipes.getAll()
  }
}
