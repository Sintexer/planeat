import type {
  GenerationPreset,
  GenerationPresetId,
} from '../../../domain/generationPresets/GenerationPreset'
import type {
  CreateGenerationPresetInput,
  GenerationPresetRepository,
  UpdateGenerationPresetInput,
} from '../../../application/ports/GenerationPresetRepository'
import type { AppDatabase } from '../database'

export class DexieGenerationPresetRepository implements GenerationPresetRepository {
  private readonly db: AppDatabase

  constructor(db: AppDatabase) {
    this.db = db
  }

  async create(input: CreateGenerationPresetInput): Promise<GenerationPreset> {
    const now = Date.now()
    const preset: GenerationPreset = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      policyVersion: input.policyVersion,
      config: input.config,
      createdAt: now,
      updatedAt: now,
    }
    await this.db.generationPresets.add(preset)
    return preset
  }

  async getAll(): Promise<GenerationPreset[]> {
    return this.db.generationPresets.orderBy('name').toArray()
  }

  async getById(id: GenerationPresetId): Promise<GenerationPreset | undefined> {
    return this.db.generationPresets.get(id)
  }

  async findByName(name: string): Promise<GenerationPreset | undefined> {
    const needle = name.trim().toLowerCase()
    const all = await this.db.generationPresets.toArray()
    return all.find((preset) => preset.name.trim().toLowerCase() === needle)
  }

  async update(id: GenerationPresetId, changes: UpdateGenerationPresetInput): Promise<void> {
    await this.db.generationPresets.update(id, { ...changes, updatedAt: Date.now() })
  }

  async delete(id: GenerationPresetId): Promise<void> {
    await this.db.generationPresets.delete(id)
  }
}
