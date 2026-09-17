import {
  ingredientMatchesAnyIdentifier,
  ingredientMatchesName,
  type Ingredient,
  type IngredientId,
} from '../../../domain/ingredients/Ingredient'
import type {
  CreateIngredientInput,
  IngredientRepository,
  UpdateIngredientInput,
} from '../../../application/ports/IngredientRepository'
import type { AppDatabase } from '../database'

export class DexieIngredientRepository implements IngredientRepository {
  private readonly db: AppDatabase

  constructor(db: AppDatabase) {
    this.db = db
  }

  async create(input: CreateIngredientInput): Promise<Ingredient> {
    const now = Date.now()
    const ingredient: Ingredient = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      aliases: (input.aliases ?? []).map((a) => a.trim()).filter(Boolean),
      preferredLabels: [],
      localizedAliases: [],
      category: input.category?.trim() || undefined,
      shoppingSection: input.shoppingSection?.trim() || undefined,
      isCommon: input.isCommon ?? false,
      createdAt: now,
      updatedAt: now,
    }
    await this.db.ingredients.add(ingredient)
    return ingredient
  }

  async getAll(): Promise<Ingredient[]> {
    return this.db.ingredients.orderBy('name').toArray()
  }

  async getById(id: IngredientId): Promise<Ingredient | undefined> {
    return this.db.ingredients.get(id)
  }

  async findByNameOrAlias(name: string): Promise<Ingredient | undefined> {
    const all = await this.db.ingredients.toArray()
    return all.find((ingredient) => ingredientMatchesName(ingredient, name))
  }

  async findCandidatesByName(name: string): Promise<Ingredient[]> {
    const all = await this.db.ingredients.toArray()
    return all.filter((ingredient) => ingredientMatchesAnyIdentifier(ingredient, name))
  }

  async update(id: IngredientId, changes: UpdateIngredientInput): Promise<void> {
    const existing = await this.db.ingredients.get(id)
    if (!existing) return
    const next: Ingredient = { ...existing, ...changes, updatedAt: Date.now() }
    if ('shoppingSection' in changes) {
      const trimmed = changes.shoppingSection?.trim()
      if (trimmed) next.shoppingSection = trimmed
      else delete next.shoppingSection
    }
    await this.db.ingredients.put(next)
  }

  async remove(id: IngredientId): Promise<void> {
    await this.db.ingredients.delete(id)
  }
}
