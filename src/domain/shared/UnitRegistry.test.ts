import { describe, expect, it } from 'vitest'
import {
  findUnitDefinition,
  isKnownUnit,
  selectableUnitDefinitions,
  unitLabel,
  UNIT_REGISTRY,
} from './UnitRegistry'

describe('findUnitDefinition', () => {
  it('distinguishes US customary cup from metric cup', () => {
    const us = findUnitDefinition('cup-us')
    const metric = findUnitDefinition('cup-metric')
    expect(us).toBeDefined()
    expect(metric).toBeDefined()
    expect(us?.key).not.toBe(metric?.key)
  })

  it('returns undefined for an unrecognized unit', () => {
    expect(findUnitDefinition('bogus-unit')).toBeUndefined()
  })

  it('marks legacy cup and tablespoon as legacy', () => {
    expect(findUnitDefinition('cup')?.legacy).toBe(true)
    expect(findUnitDefinition('tbsp')?.legacy).toBe(true)
  })
})

describe('isKnownUnit', () => {
  it('is false for an unrecognized unit', () => {
    expect(isKnownUnit('bogus-unit')).toBe(false)
  })

  it('is true for every registered key', () => {
    for (const definition of UNIT_REGISTRY) {
      expect(isKnownUnit(definition.key)).toBe(true)
    }
  })
})

describe('unitLabel', () => {
  it('returns the raw string verbatim for an unrecognized unit', () => {
    expect(unitLabel('bogus-unit')).toBe('bogus-unit')
  })

  it('returns the registry label for a known unit', () => {
    expect(unitLabel('g')).toBe(UNIT_REGISTRY.find((d) => d.key === 'g')?.label)
  })
})

describe('selectableUnitDefinitions', () => {
  it('excludes legacy units', () => {
    const keys = selectableUnitDefinitions().map((d) => d.key)
    expect(keys).not.toContain('cup')
    expect(keys).not.toContain('tbsp')
  })

  it('includes every non-legacy key exactly once', () => {
    const nonLegacyKeys = UNIT_REGISTRY.filter((d) => !d.legacy).map((d) => d.key)
    const selectableKeys = selectableUnitDefinitions().map((d) => d.key)
    expect(selectableKeys.sort()).toEqual(nonLegacyKeys.sort())
    expect(new Set(selectableKeys).size).toBe(selectableKeys.length)
  })

  it('includes the new explicit unit keys', () => {
    const keys = selectableUnitDefinitions().map((d) => d.key)
    expect(keys).toEqual(
      expect.arrayContaining(['cup-us', 'cup-metric', 'oz-mass', 'oz-fl', 'piece']),
    )
  })
})
