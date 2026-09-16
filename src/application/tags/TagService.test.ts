import { describe, expect, it } from 'vitest'
import { tagMatchesName, type Tag, type TagId } from '../../domain/tags/Tag'
import type { CreateTagInput, TagRepository, UpdateTagInput } from '../ports/TagRepository'
import { TagService } from './TagService'

/** In-memory TagRepository test double — no Dexie/IndexedDB needed. */
class FakeTagRepository implements TagRepository {
  private rows = new Map<TagId, Tag>()
  private nextId = 1

  async create(input: CreateTagInput): Promise<Tag> {
    const tag: Tag = {
      id: `tag-${this.nextId++}`,
      name: input.name,
      createdAt: 0,
      updatedAt: 0,
    }
    this.rows.set(tag.id, tag)
    return tag
  }

  async getAll(): Promise<Tag[]> {
    return [...this.rows.values()]
  }

  async getById(id: TagId): Promise<Tag | undefined> {
    return this.rows.get(id)
  }

  async getByIds(ids: TagId[]): Promise<Tag[]> {
    return ids.map((id) => this.rows.get(id)).filter((tag): tag is Tag => tag !== undefined)
  }

  async findByName(name: string): Promise<Tag | undefined> {
    return [...this.rows.values()].find((tag) => tagMatchesName(tag, name))
  }

  async update(id: TagId, changes: UpdateTagInput): Promise<void> {
    const current = this.rows.get(id)
    if (!current) return
    this.rows.set(id, { ...current, ...changes, updatedAt: 1 })
  }
}

describe('TagService.createOrLinkByName', () => {
  it('creates a new tag when none matches', async () => {
    const service = new TagService(new FakeTagRepository())
    const result = await service.createOrLinkByName('Kids picks')
    expect(result).toMatchObject({ ok: true, created: true })
  })

  it('links to an existing tag instead of creating a duplicate (case/whitespace insensitive)', async () => {
    const repo = new FakeTagRepository()
    const service = new TagService(repo)
    const first = await service.createOrLinkByName('Batch')
    const second = await service.createOrLinkByName('  batch  ')

    expect(first.ok && second.ok).toBe(true)
    if (first.ok && second.ok) {
      expect(second.created).toBe(false)
      expect(second.tag.id).toBe(first.tag.id)
    }
    expect((await repo.getAll()).length).toBe(1)
  })

  it('rejects an empty name', async () => {
    const service = new TagService(new FakeTagRepository())
    const result = await service.createOrLinkByName('   ')
    expect(result).toEqual({ ok: false, error: 'empty-name' })
  })
})

describe('TagService.renameTag', () => {
  it('renames when the new name has no collision', async () => {
    const service = new TagService(new FakeTagRepository())
    const created = await service.createOrLinkByName('italian')
    if (!created.ok) throw new Error('setup failed')

    const result = await service.renameTag(created.tag.id, 'Italian-ish')
    expect(result).toEqual({ ok: true })

    const fetched = await service.getTag(created.tag.id)
    expect(fetched?.name).toBe('Italian-ish')
  })

  it('rejects a rename that collides with another existing tag', async () => {
    const service = new TagService(new FakeTagRepository())
    const a = await service.createOrLinkByName('soup')
    await service.createOrLinkByName('vegetable')
    if (!a.ok) throw new Error('setup failed')

    const result = await service.renameTag(a.tag.id, 'Vegetable')
    expect(result).toEqual({ ok: false, error: 'name-collision' })
  })

  it('rejects an empty new name', async () => {
    const service = new TagService(new FakeTagRepository())
    const created = await service.createOrLinkByName('side')
    if (!created.ok) throw new Error('setup failed')

    const result = await service.renameTag(created.tag.id, '   ')
    expect(result).toEqual({ ok: false, error: 'empty-name' })
  })

  it('returns not-found for an unknown id', async () => {
    const service = new TagService(new FakeTagRepository())
    const result = await service.renameTag('missing', 'anything')
    expect(result).toEqual({ ok: false, error: 'not-found' })
  })
})
