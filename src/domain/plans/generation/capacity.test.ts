import { describe, expect, it } from 'vitest'
import { emptyLedger, recordCooks, dailyEffort, remainingSlotReserve } from './capacity'

describe('capacity ledger', () => {
  it('counts a cook once and reserves unfinished meals', () => {
    const ledger = emptyLedger(3)
    recordCooks(ledger, '2026-01-05', 1, 0)
    expect(dailyEffort(ledger, '2026-01-05')).toBe(1)
    ledger.remainingRequested = 2
    expect(remainingSlotReserve(ledger)).toBe(1)
  })
})
