import type { AppDatabase } from '../database'
import { buildStarterCatalog } from './starterCatalog'

/**
 * Inserts the starter ingredient/recipe/simple-food catalog when the recipe
 * library is empty. No-ops if any recipe already exists (never overwrites user data).
 */
export async function seedStarterLibraryIfEmpty(db: AppDatabase): Promise<void> {
  const recipeCount = await db.recipes.count()
  if (recipeCount > 0) return

  const { ingredients, recipes, simpleFoods, tags } = buildStarterCatalog(Date.now())

  await db.transaction('rw', db.ingredients, db.recipes, db.simpleFoods, db.tags, async () => {
    // Re-check inside the transaction in case of concurrent open tabs.
    const count = await db.recipes.count()
    if (count > 0) return

    await db.ingredients.bulkPut(ingredients)
    await db.recipes.bulkPut(recipes)
    await db.simpleFoods.bulkPut(simpleFoods)
    await db.tags.bulkPut(tags)
  })
}
