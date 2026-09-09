import type { RecipeId } from '../recipes/Recipe'
import type { SimpleFoodId } from '../simpleFoods/SimpleFood'

export type RecipePairingId = string

export type PairingTarget =
  { type: 'recipe'; id: RecipeId } | { type: 'simple-food'; id: SimpleFoodId }

export interface RecipePairing {
  id: RecipePairingId
  recipeId: RecipeId
  target: PairingTarget
  relationship: 'pairs-with'
}
