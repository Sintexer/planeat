import {
  ingredientMatchesName,
  type Ingredient,
  type IngredientId,
} from '../../domain/ingredients/Ingredient'
import type {
  CreateIngredientInput,
  IngredientRepository,
  UpdateIngredientInput,
} from '../ports/IngredientRepository'

export type CreateOrLinkResult =
  | { ok: true; ingredient: Ingredient; created: false }
  | { ok: true; ingredient: Ingredient; created: true }
  | { ok: true; ambiguous: true; candidates: Ingredient[] }
  | { ok: false; error: 'empty-name' }

export class IngredientService {
  private readonly ingredients: IngredientRepository

  constructor(ingredients: IngredientRepository) {
    this.ingredients = ingredients
  }

  listIngredients(): Promise<Ingredient[]> {
    return this.ingredients.getAll()
  }

  getIngredient(id: IngredientId): Promise<Ingredient | undefined> {
    return this.ingredients.getById(id)
  }

  async createIngredient(
    input: CreateIngredientInput,
  ): Promise<
    { ok: true; ingredient: Ingredient } | { ok: false; error: 'empty-name' | 'name-collision' }
  > {
    const name = input.name.trim()
    if (!name) return { ok: false, error: 'empty-name' }

    const existing = await this.ingredients.findByNameOrAlias(name)
    if (existing) return { ok: false, error: 'name-collision' }

    for (const alias of input.aliases ?? []) {
      const collision = await this.ingredients.findByNameOrAlias(alias)
      if (collision) return { ok: false, error: 'name-collision' }
    }

    const ingredient = await this.ingredients.create({
      ...input,
      name,
      aliases: (input.aliases ?? []).map((a) => a.trim()).filter(Boolean),
    })
    return { ok: true, ingredient }
  }

  async createOrLinkByName(rawName: string): Promise<CreateOrLinkResult> {
    const name = rawName.trim()
    if (!name) return { ok: false, error: 'empty-name' }

    const candidates = await this.ingredients.findCandidatesByName(name)
    if (candidates.length > 1) return { ok: true, ambiguous: true, candidates }
    if (candidates.length === 1) {
      return { ok: true, ingredient: candidates[0], created: false }
    }

    const ingredient = await this.ingredients.create({ name, aliases: [], isCommon: false })
    return { ok: true, ingredient, created: true }
  }

  /** Explicit "create new anyway" escape hatch for a disambiguation flow — skips lookup entirely. */
  async createIngredientForName(
    rawName: string,
  ): Promise<{ ok: true; ingredient: Ingredient } | { ok: false; error: 'empty-name' }> {
    const name = rawName.trim()
    if (!name) return { ok: false, error: 'empty-name' }
    const ingredient = await this.ingredients.create({ name, aliases: [], isCommon: false })
    return { ok: true, ingredient }
  }

  async updateIngredient(
    id: IngredientId,
    changes: UpdateIngredientInput,
  ): Promise<{ ok: true } | { ok: false; error: 'not-found' | 'empty-name' | 'name-collision' }> {
    const current = await this.ingredients.getById(id)
    if (!current) return { ok: false, error: 'not-found' }

    const nextName = changes.name !== undefined ? changes.name.trim() : current.name
    if (!nextName) return { ok: false, error: 'empty-name' }

    const nextAliases =
      changes.aliases !== undefined
        ? changes.aliases.map((a) => a.trim()).filter(Boolean)
        : current.aliases

    const nextLocalizedAliases =
      changes.localizedAliases !== undefined
        ? changes.localizedAliases
        : (current.localizedAliases ?? [])

    // Collision checks cover name/aliases/localizedAliases only — never preferredLabels,
    // which two different ingredients may legitimately share (see Ingredient.ts).
    const all = await this.ingredients.getAll()
    const conflict = all.find(
      (ingredient) =>
        ingredient.id !== id &&
        (ingredientMatchesName(ingredient, nextName) ||
          nextAliases.some((alias) => ingredientMatchesName(ingredient, alias)) ||
          nextLocalizedAliases.some((alias) => ingredientMatchesName(ingredient, alias.text))),
    )
    if (conflict) return { ok: false, error: 'name-collision' }

    await this.ingredients.update(id, {
      ...changes,
      name: nextName,
      aliases: nextAliases,
    })
    return { ok: true }
  }

  async deleteIngredient(
    id: IngredientId,
  ): Promise<{ ok: true } | { ok: false; error: 'not-found' }> {
    const current = await this.ingredients.getById(id)
    if (!current) return { ok: false, error: 'not-found' }
    await this.ingredients.remove(id)
    return { ok: true }
  }
}
