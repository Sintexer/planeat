import { describe, expect, it } from 'vitest'
import { recencyPenalty, emptyRecency, rememberUse } from './recency'

describe('recencyPenalty', () => {
  it('treats a leftover eaten Thursday as recent on Friday', () => {
    const state = emptyRecency()
    rememberUse(state, 'main', 'chili', '2026-01-08')
    expect(recencyPenalty(state, 'main', 'chili', '2026-01-09')).toBeGreaterThan(
      recencyPenalty(state, 'main', 'stew', '2026-01-09'),
    )
  })
})
