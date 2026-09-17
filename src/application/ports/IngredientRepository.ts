import type { Ingredient, IngredientId } from '../../domain/ingredients/Ingredient'

export type CreateIngredientInput = {
  name: string
  aliases?: string[]
  category?: string
  shoppingSection?: string
  isCommon?: boolean
}

export type UpdateIngredientInput = Partial<
  Pick<
    Ingredient,
    | 'name'
    | 'aliases'
    | 'preferredLabels'
    | 'localizedAliases'
    | 'category'
    | 'shoppingSection'
    | 'isCommon'
  >
>

export interface IngredientRepository {
  create(input: CreateIngredientInput): Promise<Ingredient>
  getAll(): Promise<Ingredient[]>
  getById(id: IngredientId): Promise<Ingredient | undefined>
  findByNameOrAlias(name: string): Promise<Ingredient | undefined>
  /** Every ingredient matching `name` by identity or preferred label — for safe link resolution. */
  findCandidatesByName(name: string): Promise<Ingredient[]>
  update(id: IngredientId, changes: UpdateIngredientInput): Promise<void>
  remove(id: IngredientId): Promise<void>
}
