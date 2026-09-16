import { tagMatchesName, type Tag, type TagId } from '../../../domain/tags/Tag'
import type {
  CreateTagInput,
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
}
