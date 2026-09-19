import { describe, expect, it } from 'vitest'
import type {
  GenerationPreset,
  GenerationPresetId,
} from '../../domain/generationPresets/GenerationPreset'
import { configFromSettings } from '../../domain/plans/generation/GenerationConfig'
import { DEFAULT_SETTINGS } from '../../domain/shared/Settings'
import type {
  CreateGenerationPresetInput,
  GenerationPresetRepository,
  UpdateGenerationPresetInput,
} from '../ports/GenerationPresetRepository'
import { GenerationPresetService } from './GenerationPresetService'

class FakeGenerationPresetRepository implements GenerationPresetRepository {
  private rows = new Map<GenerationPresetId, GenerationPreset>()
  private nextId = 1

  async create(input: CreateGenerationPresetInput): Promise<GenerationPreset> {
    const preset: GenerationPreset = {
      id: `preset-${this.nextId++}`,
      name: input.name,
      policyVersion: input.policyVersion,
      config: input.config,
      createdAt: 0,
      updatedAt: 0,
    }
    this.rows.set(preset.id, preset)
    return preset
  }

  async getAll(): Promise<GenerationPreset[]> {
    return [...this.rows.values()]
  }

  async getById(id: GenerationPresetId): Promise<GenerationPreset | undefined> {
    return this.rows.get(id)
  }

  async findByName(name: string): Promise<GenerationPreset | undefined> {
    const needle = name.trim().toLowerCase()
    return [...this.rows.values()].find((preset) => preset.name.trim().toLowerCase() === needle)
  }

  async update(id: GenerationPresetId, changes: UpdateGenerationPresetInput): Promise<void> {
    const current = this.rows.get(id)
    if (!current) return
    this.rows.set(id, { ...current, ...changes, updatedAt: 1 })
  }

  async delete(id: GenerationPresetId): Promise<void> {
    this.rows.delete(id)
  }
}

describe('GenerationPresetService', () => {
  it('creates, updates, and keeps a colliding Save as new from overwriting', async () => {
    const service = new GenerationPresetService(new FakeGenerationPresetRepository())
    const weeknight = await service.create('Weeknight', configFromSettings(DEFAULT_SETTINGS))
    expect(weeknight.ok).toBe(true)
    if (!weeknight.ok) return

    const duplicate = await service.create('weeknight', configFromSettings(DEFAULT_SETTINGS))
    expect(duplicate).toEqual({ ok: false, error: 'name-collision' })

    const other = await service.create('Batch Sunday', configFromSettings(DEFAULT_SETTINGS))
    expect(other.ok).toBe(true)

    const updated = await service.updateConfig(weeknight.preset.id, {
      ...weeknight.preset.config,
      generationHardPolicy: {
        ...weeknight.preset.config.generationHardPolicy,
        maxTotalTimeMinutes: 25,
      },
    })
    expect(updated).toEqual({ ok: true })

    const listed = await service.list()
    const weeknightRow = listed.find((preset) => preset.id === weeknight.preset.id)
    expect(weeknightRow?.config.generationHardPolicy.maxTotalTimeMinutes).toBe(25)
    expect(listed.find((preset) => preset.name === 'Batch Sunday')).toBeTruthy()
  })

  it('returns user errors instead of throwing for empty or colliding names', async () => {
    const service = new GenerationPresetService(new FakeGenerationPresetRepository())
    expect(await service.create('  ', configFromSettings(DEFAULT_SETTINGS))).toEqual({
      ok: false,
      error: 'empty-name',
    })
    const created = await service.create('Weeknight', configFromSettings(DEFAULT_SETTINGS))
    expect(created.ok).toBe(true)
    if (!created.ok) return

    expect(await service.rename(created.preset.id, '')).toEqual({ ok: false, error: 'empty-name' })
    const second = await service.create('Other', configFromSettings(DEFAULT_SETTINGS))
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(await service.rename(second.preset.id, 'Weeknight')).toEqual({
      ok: false,
      error: 'name-collision',
    })
    expect(await service.delete('missing')).toEqual({ ok: false, error: 'not-found' })
    expect(await service.updateConfig('missing', configFromSettings(DEFAULT_SETTINGS))).toEqual({
      ok: false,
      error: 'not-found',
    })
  })
})
