import { describe, expect, it } from 'vitest'
import { IngredientService } from './IngredientService'
import {
  ingredientMatchesAnyIdentifier,
  ingredientMatchesName,
  type Ingredient,
  type IngredientId,
} from '../../domain/ingredients/Ingredient'
import type {
  CreateIngredientInput,
  IngredientRepository,
  UpdateIngredientInput,
} from '../ports/IngredientRepository'

/** In-memory IngredientRepository test double — no Dexie/IndexedDB needed. */
class FakeIngredientRepository implements IngredientRepository {
  private rows = new Map<IngredientId, Ingredient>()
  private nextId = 1

  async create(input: CreateIngredientInput): Promise<Ingredient> {
    const ingredient: Ingredient = {
      id: `ing-${this.nextId++}`,
      name: input.name,
      aliases: input.aliases ?? [],
      preferredLabels: [],
      localizedAliases: [],
      category: input.category,
      isCommon: input.isCommon ?? false,
      createdAt: 0,
      updatedAt: 0,
    }
    this.rows.set(ingredient.id, ingredient)
    return ingredient
  }

  async getAll(): Promise<Ingredient[]> {
    return [...this.rows.values()]
  }

  async getById(id: IngredientId): Promise<Ingredient | undefined> {
    return this.rows.get(id)
  }

  async findByNameOrAlias(name: string): Promise<Ingredient | undefined> {
    return [...this.rows.values()].find((ingredient) => ingredientMatchesName(ingredient, name))
  }

  async findCandidatesByName(name: string): Promise<Ingredient[]> {
    return [...this.rows.values()].filter((ingredient) =>
      ingredientMatchesAnyIdentifier(ingredient, name),
    )
  }

  async update(id: IngredientId, changes: UpdateIngredientInput): Promise<void> {
    const current = this.rows.get(id)
    if (!current) return
    this.rows.set(id, { ...current, ...changes, updatedAt: 1 })
  }

  async remove(id: IngredientId): Promise<void> {
    this.rows.delete(id)
  }

  /** Test helper — bypasses collision checks to seed a fixture directly. */
  seed(ingredient: Ingredient) {
    this.rows.set(ingredient.id, ingredient)
  }
}

describe('IngredientService.createOrLinkByName', () => {
  it('resolves "aubergine" to the existing "Eggplant" ingredient via a legacy alias', async () => {
    const repo = new FakeIngredientRepository()
    const service = new IngredientService(repo)
    const created = await repo.create({ name: 'Eggplant', aliases: ['aubergine'] })

    const result = await service.createOrLinkByName('aubergine')
    expect(result).toMatchObject({ ok: true, created: false, ingredient: { id: created.id } })
  })

  it('resolves "aubergine" to the existing ingredient via a localized alias', async () => {
    const repo = new FakeIngredientRepository()
    const service = new IngredientService(repo)
    const created = await repo.create({ name: 'Eggplant' })
    repo.seed({ ...created, localizedAliases: [{ locale: 'en', text: 'aubergine' }] })

    const result = await service.createOrLinkByName('aubergine')
    expect(result).toMatchObject({ ok: true, created: false, ingredient: { id: created.id } })
  })

  it('returns every candidate, never silently picking one, when a term is ambiguous', async () => {
    const repo = new FakeIngredientRepository()
    const service = new IngredientService(repo)
    const a = await repo.create({ name: 'Okra' })
    const b = await repo.create({ name: 'Green beans' })
    repo.seed({ ...a, aliases: ["lady's fingers"] })
    repo.seed({ ...b, localizedAliases: [{ locale: 'en', text: "lady's fingers" }] })

    const result = await service.createOrLinkByName("lady's fingers")
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect('ambiguous' in result && result.ambiguous).toBe(true)
    if (!('ambiguous' in result)) return
    expect(result.candidates.map((c) => c.id).sort()).toEqual([a.id, b.id].sort())
  })

  it('also treats a preferred label as an identifier for candidate search', async () => {
    const repo = new FakeIngredientRepository()
    const service = new IngredientService(repo)
    const created = await repo.create({ name: 'Eggplant' })
    repo.seed({ ...created, preferredLabels: [{ locale: 'en', label: 'Melongene' }] })

    const result = await service.createOrLinkByName('melongene')
    expect(result).toMatchObject({ ok: true, created: false, ingredient: { id: created.id } })
  })

  it('creates a new ingredient when nothing matches', async () => {
    const repo = new FakeIngredientRepository()
    const service = new IngredientService(repo)

    const result = await service.createOrLinkByName('Carrot')
    expect(result).toMatchObject({ ok: true, created: true, ingredient: { name: 'Carrot' } })
  })
})

describe('IngredientService.updateIngredient', () => {
  it('blocks a duplicate localizedAliases entry across ingredients', async () => {
    const repo = new FakeIngredientRepository()
    const service = new IngredientService(repo)
    const a = await repo.create({ name: 'Eggplant' })
    repo.seed({ ...a, localizedAliases: [{ locale: 'en', text: 'aubergine' }] })
    const b = await repo.create({ name: 'Zucchini' })

    const result = await service.updateIngredient(b.id, {
      localizedAliases: [{ locale: 'en', text: 'aubergine' }],
    })
    expect(result).toEqual({ ok: false, error: 'name-collision' })
  })

  it('allows two ingredients to share a preferred-label word', async () => {
    const repo = new FakeIngredientRepository()
    const service = new IngredientService(repo)
    const a = await repo.create({ name: 'Eggplant' })
    repo.seed({ ...a, preferredLabels: [{ locale: 'en', label: 'Pepper' }] })
    const b = await repo.create({ name: 'Bell pepper' })

    const result = await service.updateIngredient(b.id, {
      preferredLabels: [{ locale: 'en', label: 'Pepper' }],
    })
    expect(result).toEqual({ ok: true })
  })

  it('persists a preferred label and localized alias', async () => {
    const repo = new FakeIngredientRepository()
    const service = new IngredientService(repo)
    const ingredient = await repo.create({ name: 'Eggplant' })

    await service.updateIngredient(ingredient.id, {
      preferredLabels: [{ locale: 'en', label: 'Aubergine' }],
      localizedAliases: [{ locale: 'en', text: 'guinea squash' }],
    })

    const updated = await repo.getById(ingredient.id)
    expect(updated?.preferredLabels).toEqual([{ locale: 'en', label: 'Aubergine' }])
    expect(updated?.localizedAliases).toEqual([{ locale: 'en', text: 'guinea squash' }])
  })
})

describe('IngredientService.addLegacyAlias', () => {
  it('appends a legacy alias without assigning a locale', async () => {
    const repo = new FakeIngredientRepository()
    const service = new IngredientService(repo)
    const created = await repo.create({ name: 'Eggplant' })

    const result = await service.addLegacyAlias(created.id, 'aubergine')
    expect(result.ok).toBe(true)
    const updated = await repo.getById(created.id)
    expect(updated?.aliases).toEqual(['aubergine'])
    expect(updated?.localizedAliases).toEqual([])
  })

  it('is a no-op when the phrase already identifies the ingredient', async () => {
    const repo = new FakeIngredientRepository()
    const service = new IngredientService(repo)
    const created = await repo.create({ name: 'Eggplant', aliases: ['aubergine'] })

    const result = await service.addLegacyAlias(created.id, 'Aubergine')
    expect(result.ok).toBe(true)
    const updated = await repo.getById(created.id)
    expect(updated?.aliases).toEqual(['aubergine'])
  })

  it('returns name-collision when another ingredient already owns the phrase', async () => {
    const repo = new FakeIngredientRepository()
    const service = new IngredientService(repo)
    const eggplant = await repo.create({ name: 'Eggplant' })
    await repo.create({ name: 'Zucchini', aliases: ['aubergine'] })

    const result = await service.addLegacyAlias(eggplant.id, 'aubergine')
    expect(result).toEqual({ ok: false, error: 'name-collision' })
    const updated = await repo.getById(eggplant.id)
    expect(updated?.aliases).toEqual([])
  })

  it('returns empty-name for a blank phrase', async () => {
    const repo = new FakeIngredientRepository()
    const service = new IngredientService(repo)
    const created = await repo.create({ name: 'Eggplant' })
    expect(await service.addLegacyAlias(created.id, '   ')).toEqual({
      ok: false,
      error: 'empty-name',
    })
  })
})
