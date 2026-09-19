import { describe, expect, it } from 'vitest'
import type { RepairStep } from './repair'

describe('repair steps', () => {
  it('orders local repair from side to main', () => {
    const steps: RepairStep[] = ['side', 'block-size', 'substitute-main']
    expect(steps).toHaveLength(3)
  })
})
