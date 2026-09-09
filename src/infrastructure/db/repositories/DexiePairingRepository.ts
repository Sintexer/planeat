import type { PairingRepository } from '../../../application/ports/PairingRepository'
import type {
  PairingTarget,
  RecipePairing,
  RecipePairingId,
} from '../../../domain/pairings/RecipePairing'
import type { RecipeId } from '../../../domain/recipes/Recipe'
import type { AppDatabase } from '../database'

function sameTarget(a: PairingTarget, b: PairingTarget): boolean {
  return a.type === b.type && a.id === b.id
}

export class DexiePairingRepository implements PairingRepository {
  private readonly db: AppDatabase

  constructor(db: AppDatabase) {
    this.db = db
  }

  list(): Promise<RecipePairing[]> {
    return this.db.recipePairings.toArray()
  }

  async listForRecipe(recipeId: RecipeId): Promise<RecipePairing[]> {
    const all = await this.db.recipePairings.toArray()
    return all.filter(
      (p) => p.recipeId === recipeId || (p.target.type === 'recipe' && p.target.id === recipeId),
    )
  }

  getById(id: RecipePairingId): Promise<RecipePairing | undefined> {
    return this.db.recipePairings.get(id)
  }

  async findDuplicate(
    recipeId: RecipeId,
    target: PairingTarget,
  ): Promise<RecipePairing | undefined> {
    const all = await this.db.recipePairings.toArray()
    return all.find((p) => p.recipeId === recipeId && sameTarget(p.target, target))
  }

  async create(pairing: RecipePairing): Promise<void> {
    await this.db.recipePairings.add(pairing)
  }

  async delete(id: RecipePairingId): Promise<void> {
    await this.db.recipePairings.delete(id)
  }
}
