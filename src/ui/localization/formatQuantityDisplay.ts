import { presentQuantity } from '../../domain/shared/presentQuantity'
import type { MeasurementPreference } from '../../domain/shared/Locale'
import type { Quantity } from '../../domain/shared/Quantity'

export function formatQuantityDisplay(
  quantity: Quantity | null,
  options: {
    locale: string
    measurementPreference: MeasurementPreference
    unspecifiedLabel: string
  },
): string {
  if (quantity === null) return options.unspecifiedLabel
  const presented = presentQuantity(quantity, options.measurementPreference)
  const number = new Intl.NumberFormat(options.locale, {
    maximumFractionDigits: 3,
  }).format(presented.value)
  return `${number} ${presented.unit}`
}
