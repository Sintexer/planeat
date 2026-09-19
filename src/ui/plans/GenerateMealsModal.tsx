import {
  Button,
  Checkbox,
  Group,
  Loader,
  SegmentedControl,
  Stack,
  Switch,
  Text,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { useServices } from '../../app/servicesContext'
import type { GenerationMode } from '../../domain/plans/generation/proposal'
import { isGenerationLocked } from '../../domain/plans/MealSlot'
import type { PlanGraph } from '../../domain/plans/PlanGraph'
import type { Quantity } from '../../domain/shared/Quantity'
import { QuantityFields } from '../components/QuantityFields'
import { generationErrorMessage } from '../localization/errors'
import { mealTypeLabel } from '../localization/labels'
import { useLocalization } from '../localization/LocalizationContext'
import { confirmReplaceDependents, openProposalPreview } from './openGenerateMeal'

export function GenerateMealsModal({
  graph,
  formatQty,
  onClose,
}: {
  graph: PlanGraph
  formatQty: (quantity: Quantity) => string
  onClose: () => void
}) {
  const { generationService } = useServices()
  const { t } = useLocalization()
  const [mode, setMode] = useState<GenerationMode>('fill-empty')
  const eligibleSlots = graph.slots.filter((slot) => {
    if (slot.excluded || isGenerationLocked(slot)) return false
    const filled = graph.components.some((component) => component.slotId === slot.id)
    return mode === 'fill-empty' ? !filled : filled
  })
  const [selected, setSelected] = useState<string[]>(() =>
    graph.slots
      .filter(
        (slot) =>
          !slot.excluded &&
          !isGenerationLocked(slot) &&
          graph.components.every((component) => component.slotId !== slot.id),
      )
      .map((slot) => slot.id),
  )
  const [custom, setCustom] = useState<Record<string, boolean>>({})
  const [amounts, setAmounts] = useState<Record<string, { value: number | ''; unit: string }>>({})
  const [running, setRunning] = useState(false)

  const changeMode = (next: string) => {
    const generationMode = next === 'replace' ? 'replace' : 'fill-empty'
    setMode(generationMode)
    const nextSlots = graph.slots.filter((slot) => {
      if (slot.excluded || isGenerationLocked(slot)) return false
      const filled = graph.components.some((component) => component.slotId === slot.id)
      return generationMode === 'fill-empty' ? !filled : filled
    })
    setSelected(generationMode === 'fill-empty' ? nextSlots.map((slot) => slot.id) : [])
  }

  const toggle = (slotId: string, checked: boolean) => {
    setSelected((current) =>
      checked ? [...current, slotId] : current.filter((id) => id !== slotId),
    )
  }

  const run = async () => {
    const overrides: Record<string, Quantity> = {}
    for (const slotId of selected) {
      if (!custom[slotId]) continue
      const amount = amounts[slotId]
      if (!amount || amount.value === '') continue
      overrides[slotId] = { value: amount.value, unit: amount.unit }
    }
    let slotIds = selected
    if (mode === 'replace') {
      const inspected = await generationService.inspectReplaceDependents(selected)
      if (!inspected.ok) {
        notifications.show({ message: generationErrorMessage(t, inspected.error), color: 'error' })
        return
      }
      if (inspected.value.extraSlots.length > 0) {
        const confirmed = await confirmReplaceDependents(t, inspected.value.extraSlots)
        if (!confirmed) return
        slotIds = [...new Set([...selected, ...inspected.value.extraSlots.map((slot) => slot.id)])]
      }
    }
    setRunning(true)
    const result = await generationService.startGeneration(slotIds, {
      quantityOverrides: Object.keys(overrides).length > 0 ? overrides : undefined,
      mode,
    })
    setRunning(false)
    if (!result.ok) {
      if (result.error !== 'cancelled') {
        notifications.show({ message: generationErrorMessage(t, result.error), color: 'error' })
      }
      return
    }
    onClose()
    openProposalPreview({
      proposal: result.value,
      generationService,
      t,
      formatQty,
    })
  }

  return (
    <Stack gap="sm">
      <SegmentedControl
        fullWidth
        value={mode}
        onChange={changeMode}
        data={[
          { value: 'fill-empty', label: t('generation.modeFillEmpty') },
          { value: 'replace', label: t('generation.modeReplace') },
        ]}
      />
      <Text size="sm">
        {mode === 'replace' ? t('generation.selectReplaceSlots') : t('generation.selectSlots')}
      </Text>
      {eligibleSlots.length === 0 && (
        <Text size="sm" c="dimmed">
          {mode === 'replace' ? t('generation.noReplaceSlots') : t('generation.noEmptySlots')}
        </Text>
      )}
      {eligibleSlots.map((slot) => (
        <Stack key={slot.id} gap={6}>
          <Checkbox
            checked={selected.includes(slot.id)}
            label={`${slot.date} · ${mealTypeLabel(t, slot.mealType)}`}
            onChange={(event) => toggle(slot.id, event.currentTarget.checked)}
          />
          {selected.includes(slot.id) && (
            <>
              <Switch
                size="sm"
                label={t('generation.customAmount')}
                checked={custom[slot.id] === true}
                onChange={(event) =>
                  setCustom((current) => ({
                    ...current,
                    [slot.id]: event.currentTarget.checked,
                  }))
                }
              />
              {custom[slot.id] && (
                <QuantityFields
                  value={amounts[slot.id]?.value ?? graph.plan.peopleCount}
                  unit={amounts[slot.id]?.unit ?? 'serving'}
                  onValueChange={(value) =>
                    setAmounts((current) => ({
                      ...current,
                      [slot.id]: { value, unit: current[slot.id]?.unit ?? 'serving' },
                    }))
                  }
                  onUnitChange={(unit) =>
                    setAmounts((current) => ({
                      ...current,
                      [slot.id]: {
                        value: current[slot.id]?.value ?? graph.plan.peopleCount,
                        unit,
                      },
                    }))
                  }
                />
              )}
            </>
          )}
        </Stack>
      ))}
      {running ? (
        <Group>
          <Loader size="sm" />
          <Text size="sm">{t('generation.running')}</Text>
          <Button
            variant="default"
            onClick={() => {
              generationService.cancel()
              setRunning(false)
            }}
          >
            {t('action.cancel')}
          </Button>
        </Group>
      ) : (
        <Group>
          <Button disabled={selected.length === 0} onClick={() => void run()}>
            {t('generation.generate')}
          </Button>
          <Button variant="default" onClick={onClose}>
            {t('action.cancel')}
          </Button>
        </Group>
      )}
    </Stack>
  )
}
