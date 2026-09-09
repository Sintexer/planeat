import { Button, Stack, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import type { PlanService } from '../../application/plans/PlanService'
import { MEAL_TYPE_LABELS, type MealType } from '../../domain/shared/MealEnums'

function planErrorMessage(error: string): string {
  switch (error) {
    case 'over-allocated':
      return 'That uses more than the planned prep output.'
    case 'reuse-forbidden':
      return 'This recipe cannot be reused on that day.'
    case 'before-prep':
      return 'A meal cannot use prep before its scheduled day.'
    case 'incompatible-quantity':
      return 'Quantities use incompatible units.'
    case 'invalid-quantity':
      return 'Enter a valid positive quantity.'
    default:
      return `Could not update (${error})`
  }
}

function formatDependentLine(date: string, mealType: MealType | string): string {
  const label = mealType in MEAL_TYPE_LABELS ? MEAL_TYPE_LABELS[mealType as MealType] : mealType
  return `${date} ${label}`
}

export async function confirmClearSlot(planService: PlanService, slotId: string): Promise<void> {
  const shared = await planService.listSharedDependentsForSlot(slotId)
  if (!shared.ok) {
    notifications.show({ message: planErrorMessage(shared.error), color: 'red' })
    return
  }

  if (shared.shared.length === 0) {
    modals.openConfirmModal({
      title: 'Clear meal',
      children: <Text size="sm">Remove all components from this meal?</Text>,
      labels: { confirm: 'Clear', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        void planService.clearSlot(slotId).then((result) => {
          if (!result.ok) {
            notifications.show({ message: 'Could not clear slot', color: 'red' })
          }
        })
      },
    })
    return
  }

  modals.open({
    title: 'Clear meal with shared prep',
    children: (
      <Stack gap="sm">
        <Text size="sm">This meal uses preparation that also supplies other meals:</Text>
        {shared.shared.map((entry) => (
          <Stack key={entry.eventId} gap={2}>
            <Text size="sm" fw={600}>
              {entry.name}
            </Text>
            {entry.dependents.map((d) => (
              <Text key={d.componentId} size="sm">
                • {formatDependentLine(d.date, d.mealType)}
              </Text>
            ))}
          </Stack>
        ))}
        <Button
          onClick={() => {
            modals.closeAll()
            void planService.clearSlot(slotId).then((result) => {
              if (!result.ok) {
                notifications.show({ message: 'Could not clear slot', color: 'red' })
              }
            })
          }}
        >
          Clear this meal only
        </Button>
        <Button
          color="red"
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
          Remove shared prep from all meals
        </Button>
        <Button variant="default" onClick={() => modals.closeAll()}>
          Cancel
        </Button>
      </Stack>
    ),
  })
}

export async function confirmExcludeSlot(planService: PlanService, slotId: string): Promise<void> {
  const shared = await planService.listSharedDependentsForSlot(slotId)
  if (!shared.ok) {
    notifications.show({ message: planErrorMessage(shared.error), color: 'red' })
    return
  }

  const runExclude = () => {
    void planService.setSlotExcluded(slotId, true).then((result) => {
      if (!result.ok) {
        notifications.show({ message: 'Could not exclude slot', color: 'red' })
      }
    })
  }

  if (shared.shared.length === 0) {
    modals.openConfirmModal({
      title: 'Exclude meal',
      children: (
        <Text size="sm">Mark this meal as excluded / eating out? Components will be removed.</Text>
      ),
      labels: { confirm: 'Exclude', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: runExclude,
    })
    return
  }

  modals.open({
    title: 'Exclude meal with shared prep',
    children: (
      <Stack gap="sm">
        <Text size="sm">Excluding clears this meal. Shared preparation also supplies:</Text>
        {shared.shared.map((entry) => (
          <Stack key={entry.eventId} gap={2}>
            <Text size="sm" fw={600}>
              {entry.name}
            </Text>
            {entry.dependents.map((d) => (
              <Text key={d.componentId} size="sm">
                • {formatDependentLine(d.date, d.mealType)}
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
          Exclude this meal only
        </Button>
        <Button
          color="red"
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
          Remove shared prep from all meals and exclude
        </Button>
        <Button variant="default" onClick={() => modals.closeAll()}>
          Cancel
        </Button>
      </Stack>
    ),
  })
}
