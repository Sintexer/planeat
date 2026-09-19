import type { AppDatabase } from '../database'
import { buildStarterCatalog, SEED_RECIPE_IDS } from './starterCatalog'

/**
 * Inserts the starter ingredient/recipe/simple-food catalog when the recipe
 * library is empty. No-ops if any recipe already exists (never overwrites user data).
 */
export async function seedStarterLibraryIfEmpty(db: AppDatabase): Promise<void> {
  const recipeCount = await db.recipes.count()
  if (recipeCount > 0) {
    await seedStarterPairingsIfEmpty(db)
    return
  }

  const { ingredients, recipes, simpleFoods, tags, pairings } = buildStarterCatalog(Date.now())

  await db.transaction(
    'rw',
    db.ingredients,
    db.recipes,
    db.simpleFoods,
    db.tags,
    db.recipePairings,
    async () => {
      const count = await db.recipes.count()
      if (count > 0) return

      await db.ingredients.bulkPut(ingredients)
      await db.recipes.bulkPut(recipes)
      await db.simpleFoods.bulkPut(simpleFoods)
      await db.tags.bulkPut(tags)
      await db.recipePairings.bulkPut(pairings)
    },
  )
}

/** Adds starter cutlet pairings when the pairing table is empty and seed recipes exist. */
export async function seedStarterPairingsIfEmpty(db: AppDatabase): Promise<void> {
  const pairingCount = await db.recipePairings.count()
  if (pairingCount > 0) return
  const cutlets = await db.recipes.get(SEED_RECIPE_IDS.cutlets)
  if (!cutlets) return
  const { pairings } = buildStarterCatalog(Date.now())
  await db.transaction('rw', db.recipePairings, db.recipes, async () => {
    if ((await db.recipePairings.count()) > 0) return
    const needed = [
      SEED_RECIPE_IDS.cutlets,
      SEED_RECIPE_IDS.rice,
      SEED_RECIPE_IDS.buckwheat,
      SEED_RECIPE_IDS.potatoes,
    ]
    const found = await db.recipes.bulkGet(needed)
    if (found.some((row) => row === undefined)) return
    await db.recipePairings.bulkPut(pairings)
  })
}
