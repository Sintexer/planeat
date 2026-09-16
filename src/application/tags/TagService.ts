import { tagMatchesName, type Tag, type TagId } from '../../domain/tags/Tag'
import type { TagRepository } from '../ports/TagRepository'

export type CreateOrLinkTagResult =
  { ok: true; tag: Tag; created: boolean } | { ok: false; error: 'empty-name' }

export type RenameTagResult =
  { ok: true } | { ok: false; error: 'not-found' | 'empty-name' | 'name-collision' }

export class TagService {
  private readonly tags: TagRepository

  constructor(tags: TagRepository) {
    this.tags = tags
  }

  listTags(): Promise<Tag[]> {
    return this.tags.getAll()
  }

  getTag(id: TagId): Promise<Tag | undefined> {
    return this.tags.getById(id)
  }

  getTagsByIds(ids: TagId[]): Promise<Tag[]> {
    return this.tags.getByIds(ids)
  }

  async createOrLinkByName(rawName: string): Promise<CreateOrLinkTagResult> {
    const name = rawName.trim()
    if (!name) return { ok: false, error: 'empty-name' }

    const existing = await this.tags.findByName(name)
    if (existing) return { ok: true, tag: existing, created: false }

    const tag = await this.tags.create({ name })
    return { ok: true, tag, created: true }
  }

  async renameTag(id: TagId, rawName: string): Promise<RenameTagResult> {
    const current = await this.tags.getById(id)
    if (!current) return { ok: false, error: 'not-found' }

    const nextName = rawName.trim()
    if (!nextName) return { ok: false, error: 'empty-name' }

    const all = await this.tags.getAll()
    const conflict = all.find((tag) => tag.id !== id && tagMatchesName(tag, nextName))
    if (conflict) return { ok: false, error: 'name-collision' }

    await this.tags.update(id, { name: nextName })
    return { ok: true }
  }
}
