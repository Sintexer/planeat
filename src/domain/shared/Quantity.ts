export type Quantity = {
  value: number
  unit: string
}

/** Closed unit vocabulary for the UI; storage keeps the string as-is. */
export const QUANTITY_UNITS = [
  'g',
  'kg',
  'ml',
  'l',
  'tsp',
  'tbsp',
  'cup',
  'piece',
  'serving',
] as const

export type QuantityUnit = (typeof QUANTITY_UNITS)[number]

export function isQuantityUnit(unit: string): unit is QuantityUnit {
  return (QUANTITY_UNITS as readonly string[]).includes(unit)
}
