import type {
  CreateSimpleFoodInput,
  SimpleFoodRepository,
  UpdateSimpleFoodInput,
} from '../../../application/ports/SimpleFoodRepository'
import type { SimpleFood, SimpleFoodId } from '../../../domain/simpleFoods/SimpleFood'
import type { AppDatabase } from '../database'

export class DexieSimpleFoodRepository implements SimpleFoodRepository {
  private readonly db: AppDatabase

  constructor(db: AppDatabase) {
    this.db = db
  }

  async create(input: CreateSimpleFoodInput): Promise<SimpleFood> {
    const now = Date.now()
    const simpleFood: SimpleFood = {
      id: crypto.randomUUID(),
      ingredientId: input.ingredientId,
      name: input.name.trim(),
      defaultPortion: input.defaultPortion,
      roles: input.roles ?? [],
      mealTypes: input.mealTypes ?? [],
      tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
      enabledInSuggestions: input.enabledInSuggestions ?? true,
      createdAt: now,
      updatedAt: now,
    }
    await this.db.simpleFoods.add(simpleFood)
    return simpleFood
  }

  async getAll(): Promise<SimpleFood[]> {
    return this.db.simpleFoods.orderBy('name').toArray()
  }

  async getById(id: SimpleFoodId): Promise<SimpleFood | undefined> {
    return this.db.simpleFoods.get(id)
  }

  async update(id: SimpleFoodId, changes: UpdateSimpleFoodInput): Promise<void> {
    await this.db.simpleFoods.update(id, { ...changes, updatedAt: Date.now() })
  }

  async remove(id: SimpleFoodId): Promise<void> {
    await this.db.simpleFoods.delete(id)
  }
}
