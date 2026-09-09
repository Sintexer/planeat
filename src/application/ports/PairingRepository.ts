import type {
  PairingTarget,
  RecipePairing,
  RecipePairingId,
} from '../../domain/pairings/RecipePairing'
import type { RecipeId } from '../../domain/recipes/Recipe'

export type PairingError = 'duplicate' | 'not-found' | 'self-pairing'

export interface PairingRepository {
  list(): Promise<RecipePairing[]>
  listForRecipe(recipeId: RecipeId): Promise<RecipePairing[]>
  getById(id: RecipePairingId): Promise<RecipePairing | undefined>
  findDuplicate(recipeId: RecipeId, target: PairingTarget): Promise<RecipePairing | undefined>
  create(pairing: RecipePairing): Promise<void>
  delete(id: RecipePairingId): Promise<void>
}
