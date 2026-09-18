import { Button, Group, Stack, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import type { GenerationService } from '../../application/plans/GenerationService'
import type { WeekGenerationProposal } from '../../domain/plans/generation/proposal'
import type { MealSlotId } from '../../domain/plans/MealSlot'
import type { Quantity } from '../../domain/shared/Quantity'
import { generationErrorMessage } from '../localization/errors'
import { mealTypeLabel } from '../localization/labels'
import type { Translate } from '../localization/t'

export async function openGenerateMealPreview(args: {
  slotId: MealSlotId
  generationService: GenerationService
  t: Translate
  formatQty: (quantity: Quantity) => string
}): Promise<void> {
  const { slotId, generationService, t, formatQty } = args
  const ran = await generationService.startGeneration([slotId])
  if (!ran.ok) {
    if (ran.error !== 'cancelled') {
      notifications.show({ message: generationErrorMessage(t, ran.error), color: 'error' })
    }
    return
  }
  openProposalPreview({ proposal: ran.value, generationService, t, formatQty })
}

export function openProposalPreview(args: {
  proposal: WeekGenerationProposal
  generationService: GenerationService
  t: Translate
  formatQty: (quantity: Quantity) => string
}): void {
  const { proposal, generationService, t, formatQty } = args
  modals.open({
    title: t('generation.previewTitle'),
    children: (
      <Stack gap="sm">
        {proposal.assignments.map((row) => (
          <Text size="sm" key={row.slotId}>
            {t('generation.previewBody', {
              name: row.recipeName,
              meal: mealTypeLabel(t, row.mealType),
              quantity: formatQty(row.allocatedQuantity),
            })}
          </Text>
        ))}
        {proposal.unfilled.map((row) => (
          <Text size="sm" c="dimmed" key={row.slotId}>
            {t('generation.unfilledRow', { meal: mealTypeLabel(t, row.mealType) })}
          </Text>
        ))}
        <Group>
          <Button
            onClick={() => {
              modals.closeAll()
              void applyProposal(generationService, proposal, t)
            }}
          >
            {t('action.apply')}
          </Button>
          <Button
            variant="default"
            onClick={() => {
              generationService.cancel(proposal)
              modals.closeAll()
            }}
          >
            {t('action.cancel')}
          </Button>
        </Group>
      </Stack>
    ),
  })
}

async function applyProposal(
  generationService: GenerationService,
  proposal: WeekGenerationProposal,
  t: Translate,
): Promise<void> {
  const result = await generationService.applyProposal(proposal)
  if (!result.ok) {
    notifications.show({ message: generationErrorMessage(t, result.error), color: 'error' })
    return
  }
  notifications.show({
    message:
      proposal.assignments.length > 1 ? t('generation.weekApplied') : t('generation.applied'),
    color: 'success',
  })
}
