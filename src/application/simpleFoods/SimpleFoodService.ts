import type { SimpleFood, SimpleFoodId } from '../../domain/simpleFoods/SimpleFood'
import type {
  CreateSimpleFoodInput,
  SimpleFoodRepository,
  UpdateSimpleFoodInput,
} from '../ports/SimpleFoodRepository'

export type SimpleFoodValidationError = 'empty-name' | 'invalid-portion' | 'missing-ingredient'

export class SimpleFoodService {
  private readonly simpleFoods: SimpleFoodRepository

  constructor(simpleFoods: SimpleFoodRepository) {
    this.simpleFoods = simpleFoods
  }

  listSimpleFoods(): Promise<SimpleFood[]> {
    return this.simpleFoods.getAll()
  }

  getSimpleFood(id: SimpleFoodId): Promise<SimpleFood | undefined> {
    return this.simpleFoods.getById(id)
  }

  async createSimpleFood(
    input: CreateSimpleFoodInput,
  ): Promise<
    { ok: true; simpleFood: SimpleFood } | { ok: false; error: SimpleFoodValidationError }
  > {
    const name = input.name.trim()
    if (!name) return { ok: false, error: 'empty-name' }
    if (!input.ingredientId) return { ok: false, error: 'missing-ingredient' }
    if (!Number.isFinite(input.defaultPortion.value) || input.defaultPortion.value <= 0) {
      return { ok: false, error: 'invalid-portion' }
    }

    const simpleFood = await this.simpleFoods.create({
      ...input,
      name,
      roles: input.roles ?? [],
      mealTypes: input.mealTypes ?? [],
      tagIds: input.tagIds ?? [],
      enabledInSuggestions: input.enabledInSuggestions ?? true,
    })
    return { ok: true, simpleFood }
  }

  async updateSimpleFood(
    id: SimpleFoodId,
    changes: UpdateSimpleFoodInput,
  ): Promise<{ ok: true } | { ok: false; error: SimpleFoodValidationError | 'not-found' }> {
    const current = await this.simpleFoods.getById(id)
    if (!current) return { ok: false, error: 'not-found' }

    const nextName = changes.name !== undefined ? changes.name.trim() : current.name
    if (!nextName) return { ok: false, error: 'empty-name' }

    const nextPortion = changes.defaultPortion ?? current.defaultPortion
    if (!Number.isFinite(nextPortion.value) || nextPortion.value <= 0) {
      return { ok: false, error: 'invalid-portion' }
    }

    const nextIngredientId = changes.ingredientId ?? current.ingredientId
    if (!nextIngredientId) return { ok: false, error: 'missing-ingredient' }

    await this.simpleFoods.update(id, {
      ...changes,
      name: nextName,
      defaultPortion: nextPortion,
      ingredientId: nextIngredientId,
    })
    return { ok: true }
  }

  async setEnabledInSuggestions(
    id: SimpleFoodId,
    enabled: boolean,
  ): Promise<{ ok: true } | { ok: false; error: 'not-found' }> {
    const current = await this.simpleFoods.getById(id)
    if (!current) return { ok: false, error: 'not-found' }
    await this.simpleFoods.update(id, { enabledInSuggestions: enabled })
    return { ok: true }
  }

  async deleteSimpleFood(
    id: SimpleFoodId,
  ): Promise<{ ok: true } | { ok: false; error: 'not-found' }> {
    const current = await this.simpleFoods.getById(id)
    if (!current) return { ok: false, error: 'not-found' }
    await this.simpleFoods.remove(id)
    return { ok: true }
  }
}
