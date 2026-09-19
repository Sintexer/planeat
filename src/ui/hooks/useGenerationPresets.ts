import { useLiveQuery } from 'dexie-react-hooks'
import type { GenerationPreset } from '../../domain/generationPresets/GenerationPreset'
import { db } from '../../infrastructure/db/database'

export function useGenerationPresets(): GenerationPreset[] | undefined {
  return useLiveQuery(() => db.generationPresets.orderBy('name').toArray(), [])
}
