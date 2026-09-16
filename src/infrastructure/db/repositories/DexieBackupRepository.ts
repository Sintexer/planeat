import type { BackupRepository } from '../../../application/ports/BackupRepository'
import type { BackupFile } from '../../../domain/shared/Backup'
import { DEFAULT_SETTINGS } from '../../../domain/shared/Settings'
import type { AppDatabase } from '../database'

export class DexieBackupRepository implements BackupRepository {
  private readonly db: AppDatabase

  constructor(db: AppDatabase) {
    this.db = db
  }

  async exportAll(): Promise<BackupFile['data']> {
    const [
      recipes,
      settings,
      ingredients,
      simpleFoods,
      plans,
      mealSlots,
      mealComponents,
      cookingEvents,
      prepSessions,
      groceryLists,
      groceryItems,
      mealFavorites,
      recipePairings,
      tags,
    ] = await Promise.all([
      this.db.recipes.toArray(),
      this.db.settings.toArray(),
      this.db.ingredients.toArray(),
      this.db.simpleFoods.toArray(),
      this.db.plans.toArray(),
      this.db.mealSlots.toArray(),
      this.db.mealComponents.toArray(),
      this.db.cookingEvents.toArray(),
      this.db.prepSessions.toArray(),
      this.db.groceryLists.toArray(),
      this.db.groceryItems.toArray(),
      this.db.mealFavorites.toArray(),
      this.db.recipePairings.toArray(),
      this.db.tags.toArray(),
    ])
    return {
      recipes,
      settings,
      ingredients,
      simpleFoods,
      plans,
      mealSlots,
      mealComponents,
      cookingEvents,
      prepSessions,
      groceryLists,
      groceryItems,
      mealFavorites,
      recipePairings,
      tags,
    }
  }

  async replaceAll(data: BackupFile['data']): Promise<void> {
    await this.db.transaction(
      'rw',
      [
        this.db.recipes,
        this.db.settings,
        this.db.ingredients,
        this.db.simpleFoods,
        this.db.plans,
        this.db.mealSlots,
        this.db.mealComponents,
        this.db.cookingEvents,
        this.db.prepSessions,
        this.db.groceryLists,
        this.db.groceryItems,
        this.db.mealFavorites,
        this.db.recipePairings,
        this.db.tags,
      ],
      async () => {
        await this.db.recipes.clear()
        await this.db.settings.clear()
        await this.db.ingredients.clear()
        await this.db.simpleFoods.clear()
        await this.db.plans.clear()
        await this.db.mealSlots.clear()
        await this.db.mealComponents.clear()
        await this.db.cookingEvents.clear()
        await this.db.prepSessions.clear()
        await this.db.groceryLists.clear()
        await this.db.groceryItems.clear()
        await this.db.mealFavorites.clear()
        await this.db.recipePairings.clear()
        await this.db.tags.clear()

        await this.db.recipes.bulkAdd(data.recipes)
        await this.db.settings.bulkAdd(
          data.settings.length > 0 ? data.settings : [DEFAULT_SETTINGS],
        )
        await this.db.ingredients.bulkAdd(data.ingredients)
        await this.db.simpleFoods.bulkAdd(data.simpleFoods)
        await this.db.plans.bulkAdd(data.plans)
        await this.db.mealSlots.bulkAdd(data.mealSlots)
        await this.db.mealComponents.bulkAdd(data.mealComponents)
        await this.db.cookingEvents.bulkAdd(data.cookingEvents)
        await this.db.prepSessions.bulkAdd(data.prepSessions)
        await this.db.groceryLists.bulkAdd(data.groceryLists)
        await this.db.groceryItems.bulkAdd(data.groceryItems)
        await this.db.mealFavorites.bulkAdd(data.mealFavorites)
        await this.db.recipePairings.bulkAdd(data.recipePairings)
        await this.db.tags.bulkAdd(data.tags)
      },
    )
  }
}
