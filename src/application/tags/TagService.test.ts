import { describe, expect, it } from 'vitest'
import {
  removeTagId,
  rewriteTagIds,
  tagMatchesName,
  type Tag,
  type TagId,
} from '../../domain/tags/Tag'
import type {
  CreateTagInput,
  TagLiveUsage,
  TagRepository,
  UpdateTagInput,
} from '../ports/TagRepository'
import { TagService } from './TagService'

type TaggedItem = { id: string; tagIds: TagId[] }

/** In-memory TagRepository test double — no Dexie/IndexedDB needed. */
class FakeTagRepository implements TagRepository {
  private rows = new Map<TagId, Tag>()
  private nextId = 1
  recipes: TaggedItem[] = []
  simpleFoods: TaggedItem[] = []
  /** Historical snapshot labels — merge/delete must never rewrite these. */
  snapshotTagLabels: string[][] = []

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

  async countLiveAssignments(id: TagId): Promise<TagLiveUsage> {
    return {
      recipeCount: this.recipes.filter((row) => row.tagIds.includes(id)).length,
      simpleFoodCount: this.simpleFoods.filter((row) => row.tagIds.includes(id)).length,
    }
  }

  async mergeLiveAssignments(sourceId: TagId, targetId: TagId): Promise<void> {
    for (const row of this.recipes) {
      row.tagIds = rewriteTagIds(row.tagIds, sourceId, targetId)
    }
    for (const row of this.simpleFoods) {
      row.tagIds = rewriteTagIds(row.tagIds, sourceId, targetId)
    }
    this.rows.delete(sourceId)
  }

  async deleteTagAndUnassign(id: TagId): Promise<void> {
    for (const row of this.recipes) {
      row.tagIds = removeTagId(row.tagIds, id)
    }
    for (const row of this.simpleFoods) {
      row.tagIds = removeTagId(row.tagIds, id)
    }
    this.rows.delete(id)
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

  it('links to an archived tag instead of creating a same-name duplicate', async () => {
    const repo = new FakeTagRepository()
    const service = new TagService(repo)
    const created = await service.createOrLinkByName('batch')
    if (!created.ok) throw new Error('setup failed')
    await service.archiveTag(created.tag.id)

    const linked = await service.createOrLinkByName('Batch')
    expect(linked.ok && !linked.created).toBe(true)
    if (linked.ok) expect(linked.tag.id).toBe(created.tag.id)
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

describe('TagService archive / merge / delete', () => {
  it('archives and unarchives without dropping live assignments', async () => {
    const repo = new FakeTagRepository()
    const service = new TagService(repo)
    const created = await service.createOrLinkByName('batch')
    if (!created.ok) throw new Error('setup failed')
    repo.recipes = [{ id: 'recipe-1', tagIds: [created.tag.id] }]

    expect(await service.archiveTag(created.tag.id)).toEqual({ ok: true })
    expect((await service.getTag(created.tag.id))?.archived).toBe(true)
    expect(repo.recipes[0]?.tagIds).toEqual([created.tag.id])

    expect(await service.unarchiveTag(created.tag.id)).toEqual({ ok: true })
    expect((await service.getTag(created.tag.id))?.archived).toBe(false)
    expect(repo.recipes[0]?.tagIds).toEqual([created.tag.id])
  })

  it('returns not-found when archiving a missing tag', async () => {
    const service = new TagService(new FakeTagRepository())
    expect(await service.archiveTag('missing')).toEqual({ ok: false, error: 'not-found' })
  })

  it('merges batch into make-ahead, collapsing duplicate live tagIds, leaving snapshots alone', async () => {
    const repo = new FakeTagRepository()
    const service = new TagService(repo)
    const batch = await service.createOrLinkByName('batch')
    const makeAhead = await service.createOrLinkByName('make-ahead')
    if (!batch.ok || !makeAhead.ok) throw new Error('setup failed')

    repo.recipes = [
      { id: 'cutlets', tagIds: [batch.tag.id, makeAhead.tag.id, 'soup'] },
      { id: 'soup', tagIds: [batch.tag.id] },
    ]
    repo.simpleFoods = [{ id: 'yogurt', tagIds: [batch.tag.id, makeAhead.tag.id] }]
    repo.snapshotTagLabels = [['batch', 'italian']]

    const result = await service.mergeTags(batch.tag.id, makeAhead.tag.id)
    expect(result).toEqual({ ok: true })
    expect(await service.getTag(batch.tag.id)).toBeUndefined()
    expect(repo.recipes.find((row) => row.id === 'cutlets')?.tagIds).toEqual([
      makeAhead.tag.id,
      'soup',
    ])
    expect(repo.recipes.find((row) => row.id === 'soup')?.tagIds).toEqual([makeAhead.tag.id])
    expect(repo.simpleFoods[0]?.tagIds).toEqual([makeAhead.tag.id])
    expect(repo.snapshotTagLabels).toEqual([['batch', 'italian']])
    expect(repo.recipes.map((row) => row.id)).toEqual(['cutlets', 'soup'])
    expect(repo.simpleFoods.map((row) => row.id)).toEqual(['yogurt'])
  })

  it('rejects merge into the same tag or a missing id', async () => {
    const service = new TagService(new FakeTagRepository())
    const a = await service.createOrLinkByName('batch')
    if (!a.ok) throw new Error('setup failed')
    expect(await service.mergeTags(a.tag.id, a.tag.id)).toEqual({ ok: false, error: 'same-tag' })
    expect(await service.mergeTags(a.tag.id, 'missing')).toEqual({ ok: false, error: 'not-found' })
  })

  it('deletes only the tag, unassigns live items, and reports usage counts', async () => {
    const repo = new FakeTagRepository()
    const service = new TagService(repo)
    const created = await service.createOrLinkByName('batch')
    if (!created.ok) throw new Error('setup failed')
    repo.recipes = [
      { id: 'cutlets', tagIds: [created.tag.id] },
      { id: 'soup', tagIds: [] },
    ]
    repo.simpleFoods = [{ id: 'yogurt', tagIds: [created.tag.id] }]
    repo.snapshotTagLabels = [['batch']]

    expect(await service.countLiveAssignments(created.tag.id)).toEqual({
      recipeCount: 1,
      simpleFoodCount: 1,
    })

    const result = await service.deleteTag(created.tag.id)
    expect(result).toEqual({ ok: true })
    expect(await service.getTag(created.tag.id)).toBeUndefined()
    expect(repo.recipes.find((row) => row.id === 'cutlets')).toEqual({ id: 'cutlets', tagIds: [] })
    expect(repo.recipes.find((row) => row.id === 'soup')).toEqual({ id: 'soup', tagIds: [] })
    expect(repo.simpleFoods[0]).toEqual({ id: 'yogurt', tagIds: [] })
    expect(repo.snapshotTagLabels).toEqual([['batch']])
  })

  it('returns not-found when deleting a missing tag', async () => {
    const service = new TagService(new FakeTagRepository())
    expect(await service.deleteTag('missing')).toEqual({ ok: false, error: 'not-found' })
  })
})
