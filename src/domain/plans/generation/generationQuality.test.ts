import { describe, expect, it } from 'vitest'
import { scaleQuantity } from '../../shared/scaleQuantity'
import { QUALITY_SEEDS, qualityFixtures, withQualitySeed } from './fixtures'
import { generationInvariantIssues, proposalIdentity } from './invariants'
import { validateProposalAgainstLive } from './proposalValidation'
import { runGenerationSearch } from './search'

describe('generation quality fixtures', () => {
  for (const fixture of qualityFixtures()) {
    describe(fixture.name, () => {
      it.each([...QUALITY_SEEDS])('holds invariants for %s', (seed) => {
        const input = withQualitySeed(fixture.input, seed)
        const proposal = runGenerationSearch(input, `req-${seed}`, scaleQuantity)
        expect(generationInvariantIssues(input, proposal)).toEqual([])

        const again = runGenerationSearch(input, `req-${seed}-b`, scaleQuantity)
        expect(proposalIdentity(again)).toBe(proposalIdentity(proposal))

        expect(
          validateProposalAgainstLive(proposal, {
            ...input,
            generationSessionId: 'session-other',
          }),
        ).toBe('stale-proposal')
      })
    })
  }

  it('rejects a fingerprint after an eligible recipe is edited', () => {
    const fixture = qualityFixtures().find((row) => row.name === 'largeSimilar')
    expect(fixture).toBeDefined()
    if (!fixture) return
    const input = withQualitySeed(fixture.input, 'seed-1')
    const proposal = runGenerationSearch(input, 'req-edit', scaleQuantity)
    const first = input.recipes[0]
    const mutated = {
      ...input,
      recipes: [{ ...first, updatedAt: first.updatedAt + 1 }, ...input.recipes.slice(1)],
    }
    expect(validateProposalAgainstLive(proposal, mutated)).toBe('stale-proposal')
  })
})
