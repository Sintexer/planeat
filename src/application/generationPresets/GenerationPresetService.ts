import type {
  GenerationPreset,
  GenerationPresetId,
} from '../../domain/generationPresets/GenerationPreset'
import {
  mergeGenerationConfig,
  serializedGenerationPolicyVersion,
  type GenerationConfig,
} from '../../domain/plans/generation/GenerationConfig'
import type { GenerationPresetRepository } from '../ports/GenerationPresetRepository'

export type GenerationPresetError = 'empty-name' | 'name-collision' | 'not-found'

function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

export class GenerationPresetService {
  private readonly presets: GenerationPresetRepository

  constructor(presets: GenerationPresetRepository) {
    this.presets = presets
  }

  list(): Promise<GenerationPreset[]> {
    return this.presets.getAll()
  }

  async create(
    rawName: string,
    config: GenerationConfig,
  ): Promise<{ ok: true; preset: GenerationPreset } | { ok: false; error: GenerationPresetError }> {
    const name = rawName.trim()
    if (!name) return { ok: false, error: 'empty-name' }
    const existing = await this.presets.findByName(name)
    if (existing) return { ok: false, error: 'name-collision' }
    const preset = await this.presets.create({
      name,
      policyVersion: serializedGenerationPolicyVersion(),
      config: mergeGenerationConfig(config),
    })
    return { ok: true, preset }
  }

  async rename(
    id: GenerationPresetId,
    rawName: string,
  ): Promise<{ ok: true } | { ok: false; error: GenerationPresetError }> {
    const current = await this.presets.getById(id)
    if (!current) return { ok: false, error: 'not-found' }
    const name = rawName.trim()
    if (!name) return { ok: false, error: 'empty-name' }
    const all = await this.presets.getAll()
    const conflict = all.find(
      (preset) => preset.id !== id && normalizeName(preset.name) === normalizeName(name),
    )
    if (conflict) return { ok: false, error: 'name-collision' }
    await this.presets.update(id, { name })
    return { ok: true }
  }

  async updateConfig(
    id: GenerationPresetId,
    config: GenerationConfig,
  ): Promise<{ ok: true } | { ok: false; error: GenerationPresetError }> {
    const current = await this.presets.getById(id)
    if (!current) return { ok: false, error: 'not-found' }
    await this.presets.update(id, {
      config: mergeGenerationConfig(config),
      policyVersion: serializedGenerationPolicyVersion(),
    })
    return { ok: true }
  }

  async delete(
    id: GenerationPresetId,
  ): Promise<{ ok: true } | { ok: false; error: GenerationPresetError }> {
    const current = await this.presets.getById(id)
    if (!current) return { ok: false, error: 'not-found' }
    await this.presets.delete(id)
    return { ok: true }
  }
}
