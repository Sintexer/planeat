import { describe, expect, it } from 'vitest'
import {
  defaultLibraryViewCriteria,
  type LibraryView,
  type LibraryViewId,
} from '../../domain/libraryViews/LibraryView'
import type {
  CreateLibraryViewInput,
  LibraryViewRepository,
  UpdateLibraryViewInput,
} from '../ports/LibraryViewRepository'
import { LibraryViewService } from './LibraryViewService'

class FakeLibraryViewRepository implements LibraryViewRepository {
  private rows = new Map<LibraryViewId, LibraryView>()
  private nextId = 1

  async create(input: CreateLibraryViewInput): Promise<LibraryView> {
    const view: LibraryView = {
      id: `view-${this.nextId++}`,
      name: input.name,
      criteria: input.criteria,
      createdAt: 0,
      updatedAt: 0,
    }
    this.rows.set(view.id, view)
    return view
  }

  async getAll(): Promise<LibraryView[]> {
    return [...this.rows.values()]
  }

  async getById(id: LibraryViewId): Promise<LibraryView | undefined> {
    return this.rows.get(id)
  }

  async findByName(name: string): Promise<LibraryView | undefined> {
    const needle = name.trim().toLowerCase()
    return [...this.rows.values()].find((view) => view.name.trim().toLowerCase() === needle)
  }

  async update(id: LibraryViewId, changes: UpdateLibraryViewInput): Promise<void> {
    const current = this.rows.get(id)
    if (!current) return
    this.rows.set(id, { ...current, ...changes, updatedAt: 1 })
  }

  async delete(id: LibraryViewId): Promise<void> {
    this.rows.delete(id)
  }
}

describe('LibraryViewService', () => {
  it('creates a named view and does not overwrite it when saving another name', async () => {
    const service = new LibraryViewService(new FakeLibraryViewRepository())
    const kids = await service.create('Kids lunch', {
      ...defaultLibraryViewCriteria(),
      query: 'kids',
      mealTypes: ['lunch'],
    })
    expect(kids.ok).toBe(true)
    if (!kids.ok) return

    const duplicate = await service.create('kids lunch', defaultLibraryViewCriteria())
    expect(duplicate).toEqual({ ok: false, error: 'name-collision' })

    const other = await service.create('Weeknight quick', {
      ...defaultLibraryViewCriteria(),
      effort: 'quick',
    })
    expect(other.ok).toBe(true)

    const updated = await service.updateCriteria(kids.view.id, {
      ...kids.view.criteria,
      query: 'school',
    })
    expect(updated).toEqual({ ok: true })

    const listed = await service.list()
    const kidsRow = listed.find((view) => view.id === kids.view.id)
    const otherRow = listed.find((view) => view.name === 'Weeknight quick')
    expect(kidsRow?.criteria.query).toBe('school')
    expect(otherRow?.criteria.effort).toBe('quick')
  })

  it('returns user errors instead of throwing for empty or colliding names', async () => {
    const service = new LibraryViewService(new FakeLibraryViewRepository())
    expect(await service.create('  ', defaultLibraryViewCriteria())).toEqual({
      ok: false,
      error: 'empty-name',
    })
    const created = await service.create('Kids lunch', defaultLibraryViewCriteria())
    expect(created.ok).toBe(true)
    if (!created.ok) return

    expect(await service.rename(created.view.id, '')).toEqual({ ok: false, error: 'empty-name' })
    const second = await service.create('Other', defaultLibraryViewCriteria())
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(await service.rename(second.view.id, 'Kids lunch')).toEqual({
      ok: false,
      error: 'name-collision',
    })
    expect(await service.delete('missing')).toEqual({ ok: false, error: 'not-found' })
    expect(await service.updateCriteria('missing', defaultLibraryViewCriteria())).toEqual({
      ok: false,
      error: 'not-found',
    })
  })
})
