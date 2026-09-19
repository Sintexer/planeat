import { describe, expect, it } from 'vitest'
import { cookingBlockPreview } from './cookingBlock'
import type { Recipe } from '../../recipes/Recipe'

const chili: Recipe = {
  id: 'chili',
  name: 'Chili',
  yield: { value: 6, unit: 'serving' },
  defaultPortionPerPerson: { value: 1, unit: 'serving' },
  ingredientLines: [],
  instructions: '',
  roles: ['complete'],
  mealTypes: ['dinner'],
  effort: 'regular',
  reusePolicy: 'batch-friendly',
  freezerFriendly: false,
  tagIds: [],
  createdAt: 0,
  updatedAt: 0,
}

describe('cookingBlockPreview', () => {
  it('summarizes prepare date and consumer count without persisting', () => {
    const preview = cookingBlockPreview({
      id: 'block-1',
      kind: 'main',
      recipe: chili,
      prepareSlotId: 'slot-mon',
      prepareDate: '2026-01-05',
      production: { value: 6, unit: 'serving' },
      consumptions: [
        {
          slotId: 'slot-mon',
          date: '2026-01-05',
          mealType: 'dinner',
          allocated: { value: 2, unit: 'serving' },
        },
        {
          slotId: 'slot-tue',
          date: '2026-01-06',
          mealType: 'dinner',
          allocated: { value: 2, unit: 'serving' },
        },
      ],
    })
    expect(preview.mealCount).toBe(2)
    expect(preview.recipeName).toBe('Chili')
  })
})
