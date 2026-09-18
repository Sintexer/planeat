export type UnitFamily = 'mass' | 'volume' | 'count'

export interface UnitDefinition {
  key: string
  label: string
  /** Short, display-appropriate abbreviation (e.g. "fl oz") — never a translated culinary term. */
  shortLabel: string
  family: UnitFamily
  /** convert-units code this maps to, when one exists. Absent = not resolvable by QuantityService today. */
  convertUnit?: string
  /** Pre-Sprint-12 ambiguous unit. Recognized/displayed for existing data, never offered on a new row. */
  legacy?: boolean
}

export const UNIT_REGISTRY: readonly UnitDefinition[] = [
  { key: 'g', label: 'Gram (g)', shortLabel: 'g', family: 'mass', convertUnit: 'g' },
  { key: 'kg', label: 'Kilogram (kg)', shortLabel: 'kg', family: 'mass', convertUnit: 'kg' },
  {
    key: 'oz-mass',
    label: 'Ounce, weight (oz)',
    shortLabel: 'oz',
    family: 'mass',
    convertUnit: 'oz',
  },
  { key: 'ml', label: 'Milliliter (ml)', shortLabel: 'ml', family: 'volume', convertUnit: 'ml' },
  { key: 'l', label: 'Liter (l)', shortLabel: 'l', family: 'volume', convertUnit: 'l' },
  {
    key: 'tsp',
    label: 'Teaspoon (tsp)',
    shortLabel: 'tsp',
    family: 'volume',
    convertUnit: 'tsp',
  },
  {
    key: 'tbsp',
    label: 'Tablespoon (tbsp)',
    shortLabel: 'tbsp',
    family: 'volume',
    convertUnit: 'Tbs',
  },
  {
    key: 'cup',
    label: 'Cup (legacy — unspecified convention)',
    shortLabel: 'cup',
    family: 'volume',
    convertUnit: 'cup',
    legacy: true,
  },
  {
    key: 'cup-us',
    label: 'Cup, US customary (240 ml)',
    shortLabel: 'cup',
    family: 'volume',
    convertUnit: 'cup',
  },
  { key: 'cup-metric', label: 'Cup, metric (250 ml)', shortLabel: 'cup', family: 'volume' },
  {
    key: 'oz-fl',
    label: 'Ounce, fluid (fl oz)',
    shortLabel: 'fl oz',
    family: 'volume',
    convertUnit: 'fl-oz',
  },
  { key: 'piece', label: 'Piece', shortLabel: 'piece', family: 'count' },
  { key: 'serving', label: 'Serving', shortLabel: 'serving', family: 'count' },
] as const

export function findUnitDefinition(unit: string): UnitDefinition | undefined {
  return UNIT_REGISTRY.find((definition) => definition.key === unit)
}

export function isKnownUnit(unit: string): boolean {
  return findUnitDefinition(unit) !== undefined
}

export function selectableUnitDefinitions(): UnitDefinition[] {
  return UNIT_REGISTRY.filter((definition) => !definition.legacy)
}

/** Registry label for a unit, or the raw string verbatim if it's unrecognized — never invents a meaning. */
export function unitLabel(unit: string): string {
  return findUnitDefinition(unit)?.label ?? unit
}

/** Short display abbreviation for a unit, or the raw string verbatim if it's unrecognized. */
export function unitShortLabel(unit: string): string {
  return findUnitDefinition(unit)?.shortLabel ?? unit
}
