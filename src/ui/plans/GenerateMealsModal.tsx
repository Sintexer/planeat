import {
  Button,
  Checkbox,
  Collapse,
  Group,
  Loader,
  MultiSelect,
  NumberInput,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  UnstyledButton,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CaretDown, CaretRight } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { useServices } from '../../app/servicesContext'
import type { GenerationMode } from '../../domain/plans/generation/proposal'
import {
  builtinGenerationPresetById,
  configFromSettings,
  findStaleGenerationConfigRefs,
  generationConfigEquals,
  isBuiltinGenerationPresetId,
  mergeGenerationConfig,
  type GenerationConfig,
} from '../../domain/plans/generation/GenerationConfig'
import { isGenerationLocked } from '../../domain/plans/MealSlot'
import type { PlanGraph } from '../../domain/plans/PlanGraph'
import type { Quantity } from '../../domain/shared/Quantity'
import { QuantityFields } from '../components/QuantityFields'
import { useGenerationPresets } from '../hooks/useGenerationPresets'
import { useRecipes } from '../hooks/useRecipes'
import { useSettings } from '../hooks/useSettings'
import { useTags } from '../hooks/useTags'
import { useIngredients } from '../hooks/useIngredients'
import { generationErrorMessage } from '../localization/errors'
import { mealTypeLabel } from '../localization/labels'
import { useLocalization } from '../localization/LocalizationContext'
import type { Translate } from '../localization/t'
import { confirmReplaceDependents, openProposalPreview } from './openGenerateMeal'
import { GenerationPresetsBar } from './GenerationPresetsBar'

function selectDataWithExtras(
  options: { value: string; label: string }[],
  selected: readonly string[],
  missingLabel: string,
): { value: string; label: string }[] {
  const known = new Set(options.map((option) => option.value))
  const extras = selected
    .filter((id) => !known.has(id))
    .map((id) => ({ value: id, label: missingLabel }))
  return [...options, ...extras]
}

function presetErrorMessage(
  t: Translate,
  error: 'empty-name' | 'name-collision' | 'not-found',
): string {
  if (error === 'empty-name') return t('view.error.emptyName')
  if (error === 'name-collision') return t('view.error.nameCollision')
  return t('view.error.notFound')
}

export function GenerateMealsModal({
  graph,
  formatQty,
  onClose,
}: {
  graph: PlanGraph
  formatQty: (quantity: Quantity) => string
  onClose: () => void
}) {
  const { generationService, generationPresetService } = useServices()
  const { t } = useLocalization()
  const settings = useSettings()
  const recipes = useRecipes()
  const tags = useTags()
  const ingredients = useIngredients()
  const customPresets = useGenerationPresets()
  const [mode, setMode] = useState<GenerationMode>('fill-empty')
  const [loadedPresetId, setLoadedPresetId] = useState<string | null>(null)
  const [draft, setDraft] = useState<GenerationConfig | null>(null)
  const [tweaksOpen, setTweaksOpen] = useState(false)
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

  const baseConfig = useMemo(() => {
    if (!settings) return null
    if (!loadedPresetId) return configFromSettings(settings)
    const builtin = builtinGenerationPresetById(loadedPresetId)
    if (builtin) return mergeGenerationConfig(builtin.config)
    const customPreset = customPresets?.find((preset) => preset.id === loadedPresetId)
    return customPreset ? mergeGenerationConfig(customPreset.config) : configFromSettings(settings)
  }, [settings, loadedPresetId, customPresets])

  const dirty = Boolean(draft && baseConfig && !generationConfigEquals(draft, baseConfig))
  const effective = draft ?? baseConfig

  const staleRefs = useMemo(() => {
    if (!effective) return []
    return findStaleGenerationConfigRefs(effective, {
      tagsById: new Map((tags ?? []).map((tag) => [tag.id, tag])),
      knownRecipeIds: new Set((recipes ?? []).map((recipe) => recipe.id)),
      knownIngredientIds: new Set((ingredients ?? []).map((ingredient) => ingredient.id)),
    })
  }, [effective, tags, recipes, ingredients])

  const recipeOptions = (recipes ?? []).map((recipe) => ({ value: recipe.id, label: recipe.name }))

  const selectPreset = (id: string | null) => {
    if (!settings) return
    if (id === null) {
      setLoadedPresetId(null)
      setDraft(null)
      return
    }
    const builtin = builtinGenerationPresetById(id)
    if (builtin) {
      setLoadedPresetId(id)
      setDraft(null)
      return
    }
    const customPreset = customPresets?.find((preset) => preset.id === id)
    if (!customPreset) return
    setLoadedPresetId(id)
    setDraft(null)
  }

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
    const overlay =
      effective && (loadedPresetId !== null || dirty)
        ? {
            config: effective,
            presetId: loadedPresetId ?? undefined,
          }
        : {}
    setRunning(true)
    const result = await generationService.startGeneration(slotIds, {
      quantityOverrides: Object.keys(overrides).length > 0 ? overrides : undefined,
      mode,
      ...overlay,
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
      <Text size="sm" c="dimmed">
        {t('generation.presetHelp')}
      </Text>
      <GenerationPresetsBar
        presets={customPresets ?? []}
        loadedPresetId={loadedPresetId}
        dirty={dirty}
        onSelectPreset={selectPreset}
        onSaveAsNew={async (name) => {
          if (!effective) return false
          const result = await generationPresetService.create(name, effective)
          if (!result.ok) {
            notifications.show({
              message: presetErrorMessage(t, result.error),
              color: 'error',
            })
            return false
          }
          setLoadedPresetId(result.preset.id)
          setDraft(mergeGenerationConfig(result.preset.config))
          notifications.show({
            message: t('generation.presetSaved', { name: result.preset.name }),
            color: 'success',
          })
          return true
        }}
        onUpdate={async () => {
          if (!loadedPresetId || isBuiltinGenerationPresetId(loadedPresetId) || !effective) {
            return false
          }
          const result = await generationPresetService.updateConfig(loadedPresetId, effective)
          if (!result.ok) {
            notifications.show({
              message: presetErrorMessage(t, result.error),
              color: 'error',
            })
            return false
          }
          notifications.show({ message: t('generation.presetUpdated'), color: 'success' })
          return true
        }}
        onRename={async (name) => {
          if (!loadedPresetId || isBuiltinGenerationPresetId(loadedPresetId)) return false
          const result = await generationPresetService.rename(loadedPresetId, name)
          if (!result.ok) {
            notifications.show({
              message: presetErrorMessage(t, result.error),
              color: 'error',
            })
            return false
          }
          notifications.show({ message: t('generation.presetRenamed'), color: 'success' })
          return true
        }}
        onDelete={async () => {
          if (!loadedPresetId || isBuiltinGenerationPresetId(loadedPresetId) || !settings) return
          const result = await generationPresetService.delete(loadedPresetId)
          if (!result.ok) {
            notifications.show({
              message: presetErrorMessage(t, result.error),
              color: 'error',
            })
            return
          }
          setLoadedPresetId(null)
          setDraft(null)
          notifications.show({ message: t('generation.presetDeleted'), color: 'success' })
        }}
      />
      {staleRefs.length > 0 && (
        <Text size="sm" c="dimmed">
          {t('generation.presetMissingRefs', { count: staleRefs.length })}
        </Text>
      )}
      <UnstyledButton onClick={() => setTweaksOpen((open) => !open)} type="button">
        <Group gap={6}>
          {tweaksOpen ? <CaretDown size={14} /> : <CaretRight size={14} />}
          <Text size="sm" fw={600}>
            {t('generation.requestTweaks')}
          </Text>
        </Group>
      </UnstyledButton>
      <Collapse expanded={tweaksOpen}>
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            {t('generation.requestTweaksHelp')}
          </Text>
          <MultiSelect
            label={t('settings.excludedRecipes')}
            searchable
            disabled={!effective}
            data={selectDataWithExtras(
              recipeOptions,
              effective?.generationHardPolicy.excludedRecipeIds ?? [],
              t('common.unknownItem'),
            )}
            value={[...(effective?.generationHardPolicy.excludedRecipeIds ?? [])]}
            onChange={(value) => {
              if (!effective) return
              setDraft(
                mergeGenerationConfig({
                  ...effective,
                  generationHardPolicy: {
                    ...effective.generationHardPolicy,
                    excludedRecipeIds: value,
                  },
                }),
              )
            }}
          />
          <NumberInput
            label={t('settings.maxTotalTime')}
            description={t('settings.maxTotalTimeHelp')}
            min={1}
            disabled={!effective}
            value={effective?.generationHardPolicy.maxTotalTimeMinutes ?? ''}
            onChange={(value) => {
              if (!effective) return
              const minutes = typeof value === 'number' ? value : undefined
              setDraft(
                mergeGenerationConfig({
                  ...effective,
                  generationHardPolicy: {
                    ...effective.generationHardPolicy,
                    maxTotalTimeMinutes: minutes,
                  },
                }),
              )
            }}
          />
        </Stack>
      </Collapse>
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
