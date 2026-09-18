import type { MeasurementPreference } from '../../domain/shared/Locale'
import type { Quantity } from '../../domain/shared/Quantity'
import { unitShortLabel as registryShortLabel } from '../../domain/shared/UnitRegistry'

export function formatQuantityDisplay(
  quantity: Quantity | null,
  options: {
    locale: string
    measurementPreference: MeasurementPreference
    unspecifiedLabel: string
    unitShortLabel?: (unit: string) => string
    presentForDisplay: (
      quantity: Quantity | null,
      preference: MeasurementPreference,
    ) => Quantity | null
  },
): string {
  const presented = options.presentForDisplay(quantity, options.measurementPreference)
  if (presented === null) return options.unspecifiedLabel
  const number = new Intl.NumberFormat(options.locale, {
    maximumFractionDigits: 3,
  }).format(presented.value)
  const short = options.unitShortLabel?.(presented.unit) ?? registryShortLabel(presented.unit)
  return `${number} ${short}`
}
