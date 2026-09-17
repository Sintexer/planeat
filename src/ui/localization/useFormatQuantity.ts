import { useServices } from '../../app/servicesContext'
import type { Quantity } from '../../domain/shared/Quantity'
import { formatQuantityDisplay } from './formatQuantityDisplay'
import { useLocalization } from './LocalizationContext'

export function useFormatQuantity() {
  const { bcp47, measurementPreference, t } = useLocalization()
  const { quantityService } = useServices()
  return (quantity: Quantity | null) =>
    formatQuantityDisplay(quantity, {
      locale: bcp47,
      measurementPreference,
      unspecifiedLabel: t('quantity.unspecified'),
      presentForDisplay: (q, preference) => quantityService.presentForDisplay(q, preference),
    })
}
