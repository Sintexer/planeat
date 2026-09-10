import { UpdatePrompt } from '../infrastructure/pwa/UpdatePrompt'
import { useLocalization } from '../ui/localization/LocalizationContext'

export function LocalizedUpdatePrompt() {
  const { t } = useLocalization()
  return (
    <UpdatePrompt
      offlineReadyMessage={t('pwa.offlineReady')}
      updateAvailableMessage={t('pwa.updateAvailable')}
      reloadWhenReadyLabel={t('pwa.reloadWhenReady')}
    />
  )
}
