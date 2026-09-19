import {
  Button,
  Checkbox,
  Group,
  Loader,
  MultiSelect,
  NumberInput,
  SegmentedControl,
  Stack,
  Switch,
  Text,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { useServices } from '../../app/servicesContext'
import type {
  DayLoad,
  GenerationMode,
  WeekGenerationProposal,
} from '../../domain/plans/generation/proposal'
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
import { defaultDayLoadForDates } from '../../domain/plans/generation/structure'
import { enumeratePlanDates, weekdayOf, type WeekStartDay } from '../../domain/shared/LocalDate'
import type { Quantity } from '../../domain/shared/Quantity'
import { QuantityFields } from '../components/QuantityFields'
import { ScreenHeader } from '../components/ScreenHeader'
import { useGenerationPresets } from '../hooks/useGenerationPresets'
import { useIngredients } from '../hooks/useIngredients'
import { usePlan } from '../hooks/usePlan'
import { useRecipes } from '../hooks/useRecipes'
import { useSettings } from '../hooks/useSettings'
import { useTags } from '../hooks/useTags'
import { generationErrorMessage } from '../localization/errors'
import { mealTypeLabel } from '../localization/labels'
import { useLocalization } from '../localization/LocalizationContext'
import { useFormatQuantity } from '../localization/useFormatQuantity'
import type { Translate } from '../localization/t'
import { GenerationPresetsBar } from '../plans/GenerationPresetsBar'
import {
  applyGeneratedProposal,
  confirmReplaceDependents,
  GenerationProposalView,
} from '../plans/openGenerateMeal'
import { confirmClearSlots } from '../plans/slotConfirmations'

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

export function GenerateWorkspaceScreen() {
  const { planId } = useParams()
  const navigate = useNavigate()
  const graph = usePlan(planId)
  const settings = useSettings()
  const formatQty = useFormatQuantity()
  const { t } = useLocalization()
  const { generationService, generationPresetService, planService, settingsRepository } =
    useServices()
  const recipes = useRecipes()
  const tags = useTags()
  const ingredients = useIngredients()
  const customPresets = useGenerationPresets()

  const [step, setStep] = useState(0)
  const [mode, setMode] = useState<GenerationMode>('fill-empty')
  const [loadedPresetId, setLoadedPresetId] = useState<string | null>('preset:balanced')
  const [draft, setDraft] = useState<GenerationConfig | null>(null)
  const [selected, setSelected] = useState<string[] | null>(null)
  const [custom, setCustom] = useState<Record<string, boolean>>({})
  const [amounts, setAmounts] = useState<Record<string, { value: number | ''; unit: string }>>({})
  const [dayLoad, setDayLoad] = useState<Record<string, DayLoad> | null>(null)
  const [running, setRunning] = useState(false)
  const [proposal, setProposal] = useState<WeekGenerationProposal | undefined>(undefined)

  const weekDates = useMemo(
    () => (graph ? enumeratePlanDates(graph.plan.startDate, graph.plan.dayCount) : []),
    [graph],
  )
  const prefilledLoad = useMemo(() => {
    if (!graph || !settings) return {}
    return defaultDayLoadForDates(weekDates, {
      softPrefs: {
        quickMealsOnlyDays: settings.quickMealsOnlyDays,
        avoidMultipleDemandingPreps: settings.avoidMultipleDemandingPreps,
        favorVegetablesDaily: settings.favorVegetablesDaily,
        preferredBatchPrepDays: settings.preferredBatchPrepDays,
        maxBatchPrepUnits: settings.maxBatchPrepUnits,
        generationPreferredTagIds: settings.generationPreferredTagIds,
      },
    })
  }, [graph, settings, weekDates])

  const load = dayLoad ?? prefilledLoad

  const eligibleSlots = (graph?.slots ?? []).filter((slot) => {
    if (slot.excluded || isGenerationLocked(slot)) return false
    const filled = graph?.components.some((component) => component.slotId === slot.id)
    return mode === 'fill-empty' ? !filled : filled
  })
  const selectedIds =
    selected ??
    (graph
      ? graph.slots
          .filter(
            (slot) =>
              !slot.excluded &&
              !isGenerationLocked(slot) &&
              graph.components.every((component) => component.slotId !== slot.id),
          )
          .map((slot) => slot.id)
      : [])

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
  const recipeOptions = (recipes ?? []).map((recipe) => ({ value: recipe.id, label: recipe.name }))
  const staleRefs = useMemo(() => {
    if (!effective) return []
    return findStaleGenerationConfigRefs(effective, {
      tagsById: new Map((tags ?? []).map((tag) => [tag.id, tag])),
      knownRecipeIds: new Set((recipes ?? []).map((recipe) => recipe.id)),
      knownIngredientIds: new Set((ingredients ?? []).map((ingredient) => ingredient.id)),
    })
  }, [effective, tags, recipes, ingredients])

  if (!planId) return <Navigate to="/plan" replace />
  if (!graph || !settings) {
    return (
      <Stack>
        <ScreenHeader title={t('generation.workspaceTitle')} fallbackTo="/plan" />
        <Loader size="sm" />
      </Stack>
    )
  }

  const changeMode = (next: string) => {
    const generationMode = next === 'replace' ? 'replace' : 'fill-empty'
    setMode(generationMode)
    const nextSlots = graph.slots.filter((slot) => {
      if (slot.excluded || isGenerationLocked(slot)) return false
      const filled = graph.components.some((component) => component.slotId === slot.id)
      return generationMode === 'fill-empty' ? !filled : filled
    })
    setSelected(nextSlots.map((slot) => slot.id))
  }

  const run = async () => {
    const overrides: Record<string, Quantity> = {}
    for (const slotId of selectedIds) {
      if (!custom[slotId]) continue
      const amount = amounts[slotId]
      if (!amount || amount.value === '') continue
      overrides[slotId] = { value: amount.value, unit: amount.unit }
    }
    let slotIds = selectedIds
    if (mode === 'replace') {
      const inspected = await generationService.inspectReplaceDependents(selectedIds)
      if (!inspected.ok) {
        notifications.show({ message: generationErrorMessage(t, inspected.error), color: 'error' })
        return
      }
      if (inspected.value.extraSlots.length > 0) {
        const confirmed = await confirmReplaceDependents(t, inspected.value.extraSlots)
        if (!confirmed) return
        slotIds = [
          ...new Set([...selectedIds, ...inspected.value.extraSlots.map((slot) => slot.id)]),
        ]
      }
    }
    const overlay =
      effective && (loadedPresetId !== null || dirty)
        ? { config: effective, presetId: loadedPresetId ?? undefined }
        : {}
    setRunning(true)
    const result = await generationService.startGeneration(slotIds, {
      quantityOverrides: Object.keys(overrides).length > 0 ? overrides : undefined,
      mode,
      dayLoad: load,
      ...overlay,
    })
    setRunning(false)
    if (!result.ok) {
      if (result.error !== 'cancelled') {
        notifications.show({ message: generationErrorMessage(t, result.error), color: 'error' })
      }
      return
    }
    setProposal(result.value)
    setStep(3)
  }

  const saveDefaults = async () => {
    const busy: WeekStartDay[] = []
    const free: WeekStartDay[] = []
    for (const date of weekDates) {
      const weekday = weekdayOf(date)
      if (load[date] === 'busy') busy.push(weekday)
      else free.push(weekday)
    }
    await settingsRepository.update({
      quickMealsOnlyDays: [...new Set(busy)],
      preferredBatchPrepDays: [...new Set(free)],
    })
    notifications.show({ message: t('generation.weekDefaultsSaved'), color: 'success' })
  }

  return (
    <Stack gap="md">
      <ScreenHeader title={t('generation.workspaceTitle')} fallbackTo={`/plan/${planId}`} />
      <SegmentedControl
        fullWidth
        value={String(step)}
        onChange={(value) => setStep(Number(value))}
        data={[
          { value: '0', label: t('generation.stepMeals') },
          { value: '1', label: t('generation.stepWeek') },
          { value: '2', label: t('generation.stepStyle') },
          { value: '3', label: t('generation.stepProposal') },
        ]}
      />

      {step === 0 && (
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
          {eligibleSlots.length > 0 && (
            <Checkbox
              checked={
                eligibleSlots.length > 0 &&
                eligibleSlots.every((slot) => selectedIds.includes(slot.id))
              }
              indeterminate={selectedIds.length > 0 && selectedIds.length < eligibleSlots.length}
              label={t('generation.selectAll')}
              onChange={(event) => {
                setSelected(event.currentTarget.checked ? eligibleSlots.map((slot) => slot.id) : [])
              }}
            />
          )}
          {eligibleSlots.length === 0 && (
            <Text size="sm" c="dimmed">
              {mode === 'replace' ? t('generation.noReplaceSlots') : t('generation.noEmptySlots')}
            </Text>
          )}
          {eligibleSlots.map((slot) => (
            <Stack key={slot.id} gap={6}>
              <Checkbox
                checked={selectedIds.includes(slot.id)}
                label={`${slot.date} · ${mealTypeLabel(t, slot.mealType)}`}
                onChange={(event) =>
                  setSelected((current) => {
                    const ids = current ?? selectedIds
                    return event.currentTarget.checked
                      ? [...ids, slot.id]
                      : ids.filter((id) => id !== slot.id)
                  })
                }
              />
              {selectedIds.includes(slot.id) && (
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
          {mode === 'replace' && (
            <Button
              variant="light"
              color="error"
              disabled={selectedIds.length === 0}
              onClick={() => {
                void confirmClearSlots(planService, selectedIds, t)
              }}
            >
              {t('generation.clearSelected')}
            </Button>
          )}
        </Stack>
      )}

      {step === 1 && (
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            {t('generation.weekHelp')}
          </Text>
          <Text size="sm">
            {t('generation.maxPrepShown', { units: String(settings.maxBatchPrepUnits) })}
          </Text>
          {weekDates.map((date) => (
            <Group key={date} justify="space-between">
              <Text size="sm">{date}</Text>
              <SegmentedControl
                size="xs"
                value={load[date] ?? 'free'}
                onChange={(value) =>
                  setDayLoad((current) => ({
                    ...(current ?? load),
                    [date]: value === 'busy' ? 'busy' : 'free',
                  }))
                }
                data={[
                  { value: 'busy', label: t('generation.dayBusy') },
                  { value: 'free', label: t('generation.dayFree') },
                ]}
              />
            </Group>
          ))}
          <Button variant="default" onClick={() => void saveDefaults()}>
            {t('generation.saveWeekDefaults')}
          </Button>
        </Stack>
      )}

      {step === 2 && (
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            {t('generation.presetHelp')}
          </Text>
          <GenerationPresetsBar
            presets={customPresets ?? []}
            loadedPresetId={loadedPresetId}
            dirty={dirty}
            onSelectPreset={(id) => {
              setLoadedPresetId(id)
              setDraft(null)
            }}
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
              if (!loadedPresetId || isBuiltinGenerationPresetId(loadedPresetId)) return
              const result = await generationPresetService.delete(loadedPresetId)
              if (!result.ok) {
                notifications.show({
                  message: presetErrorMessage(t, result.error),
                  color: 'error',
                })
                return
              }
              setLoadedPresetId('preset:balanced')
              setDraft(null)
              notifications.show({ message: t('generation.presetDeleted'), color: 'success' })
            }}
          />
          {staleRefs.length > 0 && (
            <Text size="sm" c="dimmed">
              {t('generation.presetMissingRefs', { count: staleRefs.length })}
            </Text>
          )}
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
          <Text size="sm" c="dimmed">
            {t('settings.batchPolicyHelp')}
          </Text>
          <NumberInput
            label={t('settings.maxExtraPlannedUses')}
            min={0}
            max={3}
            disabled={!effective}
            value={effective?.generationBatchPolicy.maxExtraPlannedUses ?? 2}
            onChange={(value) => {
              if (!effective) return
              const extra = typeof value === 'number' ? value : 0
              setDraft(
                mergeGenerationConfig({
                  ...effective,
                  generationBatchPolicy: {
                    ...effective.generationBatchPolicy,
                    maxExtraPlannedUses: extra,
                  },
                }),
              )
            }}
          />
        </Stack>
      )}

      {step === 3 && (
        <Stack gap="sm">
          {running && (
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
          )}
          {proposal && !running && (
            <>
              <GenerationProposalView proposal={proposal} t={t} formatQty={formatQty} />
              <Group>
                {proposal.assignments.length > 0 && (
                  <Button
                    onClick={() => {
                      void applyGeneratedProposal(generationService, proposal, t).then((ok) => {
                        if (ok) navigate(`/plan/${planId}`)
                      })
                    }}
                  >
                    {t('action.apply')}
                  </Button>
                )}
                <Button variant="default" onClick={() => navigate(`/plan/${planId}`)}>
                  {t('action.cancel')}
                </Button>
              </Group>
            </>
          )}
          {!proposal && !running && (
            <Text size="sm" c="dimmed">
              {t('generation.running')}
            </Text>
          )}
        </Stack>
      )}

      <Group>
        {step > 0 && (
          <Button variant="default" onClick={() => setStep((current) => current - 1)}>
            {t('generation.back')}
          </Button>
        )}
        {step < 2 && (
          <Button
            disabled={step === 0 && selectedIds.length === 0}
            onClick={() => setStep((current) => current + 1)}
          >
            {t('generation.next')}
          </Button>
        )}
        {step === 2 && (
          <Button disabled={selectedIds.length === 0 || running} onClick={() => void run()}>
            {t('generation.generate')}
          </Button>
        )}
      </Group>
    </Stack>
  )
}
