import type {
  GenerationPreset,
  GenerationPresetId,
} from '../../domain/generationPresets/GenerationPreset'
import type { GenerationConfig } from '../../domain/plans/generation/GenerationConfig'

export type CreateGenerationPresetInput = {
  name: string
  policyVersion: string
  config: GenerationConfig
}

export type UpdateGenerationPresetInput = Partial<
  Pick<GenerationPreset, 'name' | 'policyVersion' | 'config'>
>

export interface GenerationPresetRepository {
  create(input: CreateGenerationPresetInput): Promise<GenerationPreset>
  getAll(): Promise<GenerationPreset[]>
  getById(id: GenerationPresetId): Promise<GenerationPreset | undefined>
  findByName(name: string): Promise<GenerationPreset | undefined>
  update(id: GenerationPresetId, changes: UpdateGenerationPresetInput): Promise<void>
  delete(id: GenerationPresetId): Promise<void>
}
