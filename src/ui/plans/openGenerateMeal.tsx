import { Button, Group, Stack, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import type { GenerationService } from '../../application/plans/GenerationService'
import type { MealGenerationProposal } from '../../domain/plans/generation/proposal'
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
  const prepared = await generationService.prepareGeneration(slotId)
  if (!prepared.ok) {
    notifications.show({ message: generationErrorMessage(t, prepared.error), color: 'error' })
    return
  }
  const ran = generationService.runGeneration(prepared.value)
  if (!ran.ok) {
    notifications.show({ message: generationErrorMessage(t, ran.error), color: 'error' })
    return
  }
  const proposal = ran.value
  modals.open({
    title: t('generation.previewTitle'),
    children: (
      <Stack gap="sm">
        <Text size="sm">
          {t('generation.previewBody', {
            name: proposal.recipeName,
            meal: mealTypeLabel(t, proposal.mealType),
            quantity: formatQty(proposal.allocatedQuantity),
          })}
        </Text>
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
  proposal: MealGenerationProposal,
  t: Translate,
): Promise<void> {
  const result = await generationService.applyProposal(proposal)
  if (!result.ok) {
    notifications.show({ message: generationErrorMessage(t, result.error), color: 'error' })
    return
  }
  notifications.show({ message: t('generation.applied'), color: 'success' })
}
