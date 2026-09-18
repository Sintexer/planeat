import {
  addTagIds,
  removeTagId,
  rewriteTagIds,
  tagMatchesName,
  type Tag,
  type TagId,
} from '../../../domain/tags/Tag'
import type {
  CreateTagInput,
  TagLiveUsage,
  TagRepository,
  UpdateTagInput,
} from '../../../application/ports/TagRepository'
import type { AppDatabase } from '../database'

export class DexieTagRepository implements TagRepository {
  private readonly db: AppDatabase

  constructor(db: AppDatabase) {
    this.db = db
  }

  async create(input: CreateTagInput): Promise<Tag> {
    const now = Date.now()
    const tag: Tag = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      createdAt: now,
      updatedAt: now,
    }
    await this.db.tags.add(tag)
    return tag
  }

  async getAll(): Promise<Tag[]> {
    return this.db.tags.orderBy('name').toArray()
  }

  async getById(id: TagId): Promise<Tag | undefined> {
    return this.db.tags.get(id)
  }

  async getByIds(ids: TagId[]): Promise<Tag[]> {
    if (ids.length === 0) return []
    const rows = await this.db.tags.bulkGet(ids)
    return rows.filter((row): row is Tag => row !== undefined)
  }

  async findByName(name: string): Promise<Tag | undefined> {
    const all = await this.db.tags.toArray()
    return all.find((tag) => tagMatchesName(tag, name))
  }

  async update(id: TagId, changes: UpdateTagInput): Promise<void> {
    await this.db.tags.update(id, { ...changes, updatedAt: Date.now() })
  }

  async countLiveAssignments(id: TagId): Promise<TagLiveUsage> {
    const [recipes, simpleFoods] = await Promise.all([
      this.db.recipes.toArray(),
      this.db.simpleFoods.toArray(),
    ])
    return {
      recipeCount: recipes.filter((row) => row.tagIds.includes(id)).length,
      simpleFoodCount: simpleFoods.filter((row) => row.tagIds.includes(id)).length,
    }
  }

  async mergeLiveAssignments(sourceId: TagId, targetId: TagId): Promise<void> {
    await this.db.transaction(
      'rw',
      this.db.tags,
      this.db.recipes,
      this.db.simpleFoods,
      async () => {
        const now = Date.now()
        for (const recipe of await this.db.recipes.toArray()) {
          if (!recipe.tagIds.includes(sourceId)) continue
          await this.db.recipes.update(recipe.id, {
            tagIds: rewriteTagIds(recipe.tagIds, sourceId, targetId),
            updatedAt: now,
          })
        }
        for (const food of await this.db.simpleFoods.toArray()) {
          if (!food.tagIds.includes(sourceId)) continue
          await this.db.simpleFoods.update(food.id, {
            tagIds: rewriteTagIds(food.tagIds, sourceId, targetId),
            updatedAt: now,
          })
        }
        await this.db.tags.delete(sourceId)
      },
    )
  }

  async deleteTagAndUnassign(id: TagId): Promise<void> {
    await this.db.transaction(
      'rw',
      this.db.tags,
      this.db.recipes,
      this.db.simpleFoods,
      async () => {
        const now = Date.now()
        for (const recipe of await this.db.recipes.toArray()) {
          if (!recipe.tagIds.includes(id)) continue
          await this.db.recipes.update(recipe.id, {
            tagIds: removeTagId(recipe.tagIds, id),
            updatedAt: now,
          })
        }
        for (const food of await this.db.simpleFoods.toArray()) {
          if (!food.tagIds.includes(id)) continue
          await this.db.simpleFoods.update(food.id, {
            tagIds: removeTagId(food.tagIds, id),
            updatedAt: now,
          })
        }
        await this.db.tags.delete(id)
      },
    )
  }

  async applyLiveTagChanges(input: {
    recipeIds: string[]
    simpleFoodIds: string[]
    addTagIds: TagId[]
    removeTagIds: TagId[]
  }): Promise<void> {
    await this.db.transaction(
      'rw',
      this.db.tags,
      this.db.recipes,
      this.db.simpleFoods,
      async () => {
        const now = Date.now()
        for (const id of input.recipeIds) {
          const recipe = await this.db.recipes.get(id)
          if (!recipe) continue
          let tagIds = recipe.tagIds
          for (const removeId of input.removeTagIds) {
            tagIds = removeTagId(tagIds, removeId)
          }
          tagIds = addTagIds(tagIds, input.addTagIds)
          if (
            tagIds.length === recipe.tagIds.length &&
            tagIds.every((tagId, i) => tagId === recipe.tagIds[i])
          ) {
            continue
          }
          await this.db.recipes.update(id, { tagIds, updatedAt: now })
        }
        for (const id of input.simpleFoodIds) {
          const food = await this.db.simpleFoods.get(id)
          if (!food) continue
          let tagIds = food.tagIds
          for (const removeId of input.removeTagIds) {
            tagIds = removeTagId(tagIds, removeId)
          }
          tagIds = addTagIds(tagIds, input.addTagIds)
          if (
            tagIds.length === food.tagIds.length &&
            tagIds.every((tagId, i) => tagId === food.tagIds[i])
          ) {
            continue
          }
          await this.db.simpleFoods.update(id, { tagIds, updatedAt: now })
        }
      },
    )
  }
}
