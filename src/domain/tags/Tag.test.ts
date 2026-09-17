import { describe, expect, it } from 'vitest'
import {
  isTagArchived,
  normalizeTagName,
  removeTagId,
  rewriteTagIds,
  tagMatchesName,
  type Tag,
} from './Tag'

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

describe('isTagArchived', () => {
  it('treats missing archived as active', () => {
    expect(isTagArchived({ archived: undefined })).toBe(false)
    expect(isTagArchived({ archived: false })).toBe(false)
    expect(isTagArchived({ archived: true })).toBe(true)
  })
})

describe('rewriteTagIds', () => {
  it('replaces the source id and collapses a duplicate of the target', () => {
    expect(rewriteTagIds(['batch', 'make-ahead', 'soup', 'batch'], 'batch', 'make-ahead')).toEqual([
      'make-ahead',
      'soup',
    ])
  })

  it('leaves unrelated ids untouched', () => {
    expect(rewriteTagIds(['soup'], 'batch', 'make-ahead')).toEqual(['soup'])
  })
})

describe('removeTagId', () => {
  it('strips the id and keeps the rest', () => {
    expect(removeTagId(['batch', 'soup', 'batch'], 'batch')).toEqual(['soup'])
  })
})
