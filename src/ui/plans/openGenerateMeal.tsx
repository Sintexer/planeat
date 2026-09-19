import { Button, Group, Stack, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import type { GenerationService } from '../../application/plans/GenerationService'
import type { ConstraintReason } from '../../domain/plans/generation/constraints'
import type {
  GeneratedComponent,
  WeekGenerationProposal,
} from '../../domain/plans/generation/proposal'
import type { MealSlotId } from '../../domain/plans/MealSlot'
import type { Quantity } from '../../domain/shared/Quantity'
import { generationErrorMessage } from '../localization/errors'
import type { ScoreReason } from '../../domain/plans/generation/scoring'
import { constraintReasonLabel, mealTypeLabel, scoreReasonLabel } from '../localization/labels'
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
  const unfilledMealTypes = new Set(proposal.unfilled.map((row) => row.mealType))
  const dropCounts = proposal.diagnostics.dropCounts.filter((row) =>
    unfilledMealTypes.has(row.mealType),
  )
  const showDiagnostics =
    proposal.unfilled.length > 0 || proposal.diagnostics.fixedConflicts.length > 0

  modals.open({
    title: t('generation.previewTitle'),
    children: (
      <Stack gap="sm">
        {proposal.assignments.map((row) => (
          <Stack gap={2} key={row.slotId}>
            {row.source.type === 'favorite' && (
              <Text size="xs" c="dimmed">
                {t('generation.previewSourceFavorite', { name: row.source.favoriteName })}
              </Text>
            )}
            {row.source.type === 'pairing' && (
              <Text size="xs" c="dimmed">
                {t('generation.previewSourcePairing')}
              </Text>
            )}
            {row.source.type === 'leftover' && (
              <Text size="xs" c="dimmed">
                {t('generation.previewSourceLeftover', {
                  date: leftoverDate(row.components),
                })}
              </Text>
            )}
            {row.components.map((component) => (
              <Text size="sm" key={componentKey(component)}>
                {t('generation.previewBody', {
                  name: componentDisplayName(component),
                  meal: mealTypeLabel(t, row.mealType),
                  quantity: formatQty(component.allocatedQuantity),
                })}
              </Text>
            ))}
            {row.scoreReasons.map((reason, index) => (
              <Text size="xs" c="dimmed" key={`${row.slotId}-${reason.code}-${index}`}>
                {scoreReasonLine(t, reason)}
              </Text>
            ))}
          </Stack>
        ))}
        {proposal.unfilled.map((row) => (
          <Text size="sm" c="dimmed" key={row.slotId}>
            {row.reason === 'search-incomplete'
              ? t('generation.searchIncompleteRow', { meal: mealTypeLabel(t, row.mealType) })
              : t('generation.unfilledRow', { meal: mealTypeLabel(t, row.mealType) })}
          </Text>
        ))}
        {proposal.unfilled.some((row) => row.reason === 'search-incomplete') && (
          <Text size="sm" c="dimmed">
            {t('generation.searchBudgetExhausted', {
              used: proposal.expansionsUsed,
              budget: proposal.budgetUsed.expansionBudget,
            })}
          </Text>
        )}
        {showDiagnostics && (
          <Stack gap={4}>
            {dropCounts.length > 0 && (
              <Text size="sm" fw={600}>
                {t('generation.diagnosticsTitle')}
              </Text>
            )}
            {dropCounts.map((row) => (
              <Text size="sm" c="dimmed" key={`${row.mealType}-${row.reason}`}>
                {t('generation.dropCount', {
                  count: row.count,
                  meal: mealTypeLabel(t, row.mealType),
                  reason: constraintReasonLabel(t, row.reason),
                })}
              </Text>
            ))}
            {proposal.diagnostics.fixedConflicts.length > 0 && (
              <>
                <Text size="sm" fw={600}>
                  {t('generation.fixedConflictHelp')}
                </Text>
                {proposal.diagnostics.fixedConflicts.map((row) => (
                  <Text size="sm" c="dimmed" key={row.slotId}>
                    {t('generation.fixedConflict', {
                      date: row.date,
                      meal: mealTypeLabel(t, row.mealType),
                      reasons: formatReasons(t, row.reasons),
                    })}
                  </Text>
                ))}
              </>
            )}
          </Stack>
        )}
        <Group>
          {proposal.assignments.length > 0 && (
            <Button
              onClick={() => {
                modals.closeAll()
                void applyProposal(generationService, proposal, t)
              }}
            >
              {t('action.apply')}
            </Button>
          )}
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

function componentKey(component: GeneratedComponent): string {
  if (component.type === 'recipe') return `recipe:${component.recipeId}`
  if (component.type === 'leftover') return `leftover:${component.cookingEventId}`
  return `food:${component.simpleFoodId}`
}

function componentDisplayName(component: GeneratedComponent): string {
  if (component.type === 'simple-food') return component.name
  return component.recipeName
}

function leftoverDate(components: readonly GeneratedComponent[]): string {
  const leftover = components.find((row) => row.type === 'leftover')
  return leftover?.type === 'leftover' ? leftover.scheduledDate : ''
}

function scoreReasonLine(t: Translate, reason: ScoreReason): string {
  if (reason.source === 'planned-history' || reason.code === 'planned-history') {
    return t('generation.score.planned-history')
  }
  return scoreReasonLabel(t, reason.code)
}

function formatReasons(t: Translate, reasons: readonly ConstraintReason[]): string {
  return reasons.map((reason) => constraintReasonLabel(t, reason)).join(', ')
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
