import { describe, expect, it } from 'vitest'
import { normalizeTagName, tagMatchesName, type Tag } from './Tag'

describe('normalizeTagName', () => {
  it('trims and lowercases', () => {
    expect(normalizeTagName('  Kids Picks  ')).toBe('kids picks')
  })
})

describe('tagMatchesName', () => {
  const tag: Tag = { id: 'tag-1', name: 'Kids picks', createdAt: 0, updatedAt: 0 }

  it('matches case-insensitively and ignoring whitespace', () => {
    expect(tagMatchesName(tag, '  kids picks  ')).toBe(true)
    expect(tagMatchesName(tag, 'KIDS PICKS')).toBe(true)
  })

  it('does not match a different name', () => {
    expect(tagMatchesName(tag, 'batch')).toBe(false)
  })

  it('does not match an empty or whitespace-only name', () => {
    expect(tagMatchesName(tag, '   ')).toBe(false)
  })
})
