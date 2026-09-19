import type { GenerationConfig } from '../plans/generation/GenerationConfig'

export type GenerationPresetId = string

export interface GenerationPreset {
  id: GenerationPresetId
  name: string
  policyVersion: string
  config: GenerationConfig
  createdAt: number
  updatedAt: number
}
