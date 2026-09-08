import type { Quantity } from './Quantity'

/** Format a plain number for display without Fraction dependency (domain stays pure). */
export function formatQuantityValue(value: number): string {
  if (!Number.isFinite(value)) return String(value)
  if (Number.isInteger(value)) return String(value)

  const rounded = Math.round(value * 1000) / 1000
  if (Number.isInteger(rounded)) return String(rounded)
  return String(rounded)
}

export function formatQuantity(quantity: Quantity | null): string {
  if (quantity === null) return 'quantity unspecified'
  return `${formatQuantityValue(quantity.value)} ${quantity.unit}`
}
