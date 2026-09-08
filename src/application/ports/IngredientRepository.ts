import type { Ingredient, IngredientId } from '../../domain/ingredients/Ingredient'

export type CreateIngredientInput = {
  name: string
  aliases?: string[]
  category?: string
  isCommon?: boolean
}

export type UpdateIngredientInput = Partial<
  Pick<Ingredient, 'name' | 'aliases' | 'category' | 'isCommon'>
>

export interface IngredientRepository {
  create(input: CreateIngredientInput): Promise<Ingredient>
  getAll(): Promise<Ingredient[]>
  getById(id: IngredientId): Promise<Ingredient | undefined>
  findByNameOrAlias(name: string): Promise<Ingredient | undefined>
  update(id: IngredientId, changes: UpdateIngredientInput): Promise<void>
  remove(id: IngredientId): Promise<void>
}
