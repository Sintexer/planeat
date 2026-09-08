import { useLiveQuery } from 'dexie-react-hooks'
import type { Recipe, RecipeId } from '../../domain/recipes/Recipe'
import { db } from '../../infrastructure/db/database'

export function useRecipe(recipeId: RecipeId | undefined): Recipe | undefined | null {
  return useLiveQuery(async () => {
    if (!recipeId) return null
    const recipe = await db.recipes.get(recipeId)
    return recipe ?? null
  }, [recipeId])
}
