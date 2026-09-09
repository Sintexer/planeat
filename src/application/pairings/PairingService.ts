import type { PairingTarget, RecipePairing } from '../../domain/pairings/RecipePairing'
import type { RecipeId } from '../../domain/recipes/Recipe'
import type { PairingError, PairingRepository } from '../ports/PairingRepository'

export class PairingService {
  private readonly pairings: PairingRepository

  constructor(pairings: PairingRepository) {
    this.pairings = pairings
  }

  list(): Promise<RecipePairing[]> {
    return this.pairings.list()
  }

  listForRecipe(recipeId: RecipeId): Promise<RecipePairing[]> {
    return this.pairings.listForRecipe(recipeId)
  }

  async add(
    recipeId: RecipeId,
    target: PairingTarget,
  ): Promise<{ ok: true; pairing: RecipePairing } | { ok: false; error: PairingError }> {
    if (target.type === 'recipe' && target.id === recipeId) {
      return { ok: false, error: 'self-pairing' }
    }
    const existing = await this.pairings.findDuplicate(recipeId, target)
    if (existing) return { ok: false, error: 'duplicate' }

    if (target.type === 'recipe') {
      const reverse = await this.pairings.findDuplicate(target.id, {
        type: 'recipe',
        id: recipeId,
      })
      if (reverse) return { ok: false, error: 'duplicate' }
    }

    const pairing: RecipePairing = {
      id: crypto.randomUUID(),
      recipeId,
      target,
      relationship: 'pairs-with',
    }
    await this.pairings.create(pairing)
    return { ok: true, pairing }
  }

  async remove(id: string): Promise<{ ok: true } | { ok: false; error: PairingError }> {
    const existing = await this.pairings.getById(id)
    if (!existing) return { ok: false, error: 'not-found' }
    await this.pairings.delete(id)
    return { ok: true }
  }
}
