import { Button, Stack, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import type { PlanService } from '../../application/plans/PlanService'
import { mealTypeLabel } from '../localization/labels'
import { planErrorMessage } from '../localization/errors'
import type { Translate } from '../localization/t'

function formatDependentLine(t: Translate, date: string, mealType: string): string {
  return `${date} ${mealTypeLabel(t, mealType)}`
}

export async function confirmClearSlot(
  planService: PlanService,
  slotId: string,
  t: Translate,
): Promise<void> {
  const shared = await planService.listSharedDependentsForSlot(slotId)
  if (!shared.ok) {
    notifications.show({ message: planErrorMessage(t, shared.error), color: 'error' })
    return
  }

  if (shared.shared.length === 0) {
    modals.openConfirmModal({
      title: t('confirm.clearMeal'),
      children: <Text size="sm">{t('confirm.clearMealBody')}</Text>,
      labels: { confirm: t('action.clear'), cancel: t('action.cancel') },
      confirmProps: { color: 'error' },
      onConfirm: () => {
        void planService.clearSlot(slotId).then((result) => {
          if (!result.ok) {
            notifications.show({ message: t('error.clearSlot'), color: 'error' })
          }
        })
      },
    })
    return
  }

  modals.open({
    title: t('confirm.clearSharedTitle'),
    children: (
      <Stack gap="sm">
        <Text size="sm">{t('confirm.clearSharedBody')}</Text>
        {shared.shared.map((entry) => (
          <Stack key={entry.eventId} gap={2}>
            <Text size="sm" fw={600}>
              {entry.name}
            </Text>
            {entry.dependents.map((d) => (
              <Text key={d.componentId} size="sm">
                • {formatDependentLine(t, d.date, d.mealType)}
              </Text>
            ))}
          </Stack>
        ))}
        <Button
          onClick={() => {
            modals.closeAll()
            void planService.clearSlot(slotId).then((result) => {
              if (!result.ok) {
                notifications.show({ message: t('error.clearSlot'), color: 'error' })
              }
            })
          }}
        >
          {t('confirm.clearThisOnly')}
        </Button>
        <Button
          color="error"
          variant="light"
          onClick={() => {
            modals.closeAll()
            void (async () => {
              for (const entry of shared.shared) {
                await planService.removeCookingEventEverywhere(entry.eventId)
              }
              await planService.clearSlot(slotId)
            })()
          }}
        >
          {t('confirm.removeSharedAll')}
        </Button>
        <Button variant="default" onClick={() => modals.closeAll()}>
          {t('action.cancel')}
        </Button>
      </Stack>
    ),
  })
}

export async function confirmExcludeSlot(
  planService: PlanService,
  slotId: string,
  t: Translate,
): Promise<void> {
  const shared = await planService.listSharedDependentsForSlot(slotId)
  if (!shared.ok) {
    notifications.show({ message: planErrorMessage(t, shared.error), color: 'error' })
    return
  }

  const runExclude = () => {
    void planService.setSlotExcluded(slotId, true).then((result) => {
      if (!result.ok) {
        notifications.show({ message: t('error.excludeSlot'), color: 'error' })
      }
    })
  }

  if (shared.shared.length === 0) {
    modals.openConfirmModal({
      title: t('confirm.excludeMeal'),
      children: <Text size="sm">{t('confirm.excludeMealBody')}</Text>,
      labels: { confirm: t('confirm.exclude'), cancel: t('action.cancel') },
      confirmProps: { color: 'error' },
      onConfirm: runExclude,
    })
    return
  }

  modals.open({
    title: t('confirm.excludeSharedTitle'),
    children: (
      <Stack gap="sm">
        <Text size="sm">{t('confirm.excludeSharedBody')}</Text>
        {shared.shared.map((entry) => (
          <Stack key={entry.eventId} gap={2}>
            <Text size="sm" fw={600}>
              {entry.name}
            </Text>
            {entry.dependents.map((d) => (
              <Text key={d.componentId} size="sm">
                • {formatDependentLine(t, d.date, d.mealType)}
              </Text>
            ))}
          </Stack>
        ))}
        <Button
          onClick={() => {
            modals.closeAll()
            runExclude()
          }}
        >
          {t('confirm.excludeThisOnly')}
        </Button>
        <Button
          color="error"
          variant="light"
          onClick={() => {
            modals.closeAll()
            void (async () => {
              for (const entry of shared.shared) {
                await planService.removeCookingEventEverywhere(entry.eventId)
              }
              await planService.setSlotExcluded(slotId, true)
            })()
          }}
        >
          {t('confirm.removeSharedAndExclude')}
        </Button>
        <Button variant="default" onClick={() => modals.closeAll()}>
          {t('action.cancel')}
        </Button>
      </Stack>
    ),
  })
}
