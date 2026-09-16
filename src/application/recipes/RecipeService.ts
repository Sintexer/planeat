import type { Recipe, RecipeId, RecipeWriteInput } from '../../domain/recipes/Recipe'
import type { RecipeRepository } from '../ports/RecipeRepository'

export type RecipeValidationError =
  | 'empty-name'
  | 'invalid-yield'
  | 'invalid-portion'
  | 'missing-role'
  | 'missing-meal-type'
  | 'invalid-photo-url'

function normalizePhotoUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function validateWriteInput(
  input: RecipeWriteInput,
): { ok: true } | { ok: false; error: RecipeValidationError } {
  if (!input.name.trim()) return { ok: false, error: 'empty-name' }
  if (!Number.isFinite(input.yield.value) || input.yield.value <= 0) {
    return { ok: false, error: 'invalid-yield' }
  }
  if (
    !Number.isFinite(input.defaultPortionPerPerson.value) ||
    input.defaultPortionPerPerson.value <= 0
  ) {
    return { ok: false, error: 'invalid-portion' }
  }
  if (input.roles.length === 0) return { ok: false, error: 'missing-role' }
  if (input.mealTypes.length === 0) return { ok: false, error: 'missing-meal-type' }
  const photoUrl = normalizePhotoUrl(input.photoUrl)
  if (photoUrl && !isHttpUrl(photoUrl)) return { ok: false, error: 'invalid-photo-url' }
  return { ok: true }
}

export class RecipeService {
  private readonly recipes: RecipeRepository

  constructor(recipes: RecipeRepository) {
    this.recipes = recipes
  }

  listRecipes(): Promise<Recipe[]> {
    return this.recipes.getAll()
  }

  getRecipe(id: RecipeId): Promise<Recipe | undefined> {
    return this.recipes.getById(id)
  }

  async createRecipe(
    input: RecipeWriteInput,
  ): Promise<{ ok: true; recipe: Recipe } | { ok: false; error: RecipeValidationError }> {
    const validation = validateWriteInput(input)
    if (!validation.ok) return validation

    const recipe = await this.recipes.create({
      ...input,
      name: input.name.trim(),
      instructions: input.instructions.trim(),
      photoUrl: normalizePhotoUrl(input.photoUrl),
    })
    return { ok: true, recipe }
  }

  async updateRecipe(
    id: RecipeId,
    changes: Partial<RecipeWriteInput>,
  ): Promise<{ ok: true } | { ok: false; error: RecipeValidationError | 'not-found' }> {
    const current = await this.recipes.getById(id)
    if (!current) return { ok: false, error: 'not-found' }

    const merged: RecipeWriteInput = {
      name: changes.name ?? current.name,
      yield: changes.yield ?? current.yield,
      defaultPortionPerPerson: changes.defaultPortionPerPerson ?? current.defaultPortionPerPerson,
      ingredientLines: changes.ingredientLines ?? current.ingredientLines,
      instructions: changes.instructions ?? current.instructions,
      roles: changes.roles ?? current.roles,
      mealTypes: changes.mealTypes ?? current.mealTypes,
      effort: changes.effort ?? current.effort,
      activeTimeMinutes:
        changes.activeTimeMinutes !== undefined
          ? changes.activeTimeMinutes
          : current.activeTimeMinutes,
      totalTimeMinutes:
        changes.totalTimeMinutes !== undefined
          ? changes.totalTimeMinutes
          : current.totalTimeMinutes,
      reusePolicy: changes.reusePolicy ?? current.reusePolicy,
      freezerFriendly: changes.freezerFriendly ?? current.freezerFriendly,
      freezingNotes:
        changes.freezingNotes !== undefined ? changes.freezingNotes : current.freezingNotes,
      tagIds: changes.tagIds ?? current.tagIds,
      sourceUrl: changes.sourceUrl !== undefined ? changes.sourceUrl : current.sourceUrl,
      photoUrl: changes.photoUrl !== undefined ? changes.photoUrl : current.photoUrl,
      cuisine: changes.cuisine !== undefined ? changes.cuisine : current.cuisine,
      dishType: changes.dishType !== undefined ? changes.dishType : current.dishType,
      maxPreferredRepeats:
        changes.maxPreferredRepeats !== undefined
          ? changes.maxPreferredRepeats
          : current.maxPreferredRepeats,
      notes: changes.notes !== undefined ? changes.notes : current.notes,
    }

    const validation = validateWriteInput(merged)
    if (!validation.ok) return validation

    await this.recipes.update(id, {
      ...merged,
      name: merged.name.trim(),
      instructions: merged.instructions.trim(),
      photoUrl: normalizePhotoUrl(merged.photoUrl),
    })
    return { ok: true }
  }

  async deleteRecipe(id: RecipeId): Promise<{ ok: true } | { ok: false; error: 'not-found' }> {
    const current = await this.recipes.getById(id)
    if (!current) return { ok: false, error: 'not-found' }
    await this.recipes.remove(id)
    return { ok: true }
  }
}
