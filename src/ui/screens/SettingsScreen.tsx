import {
  Text,
  Stack,
  NumberInput,
  Button,
  Group,
  FileButton,
  Select,
  MultiSelect,
  Switch,
  Paper,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import dayjs from 'dayjs'
import { useEffect } from 'react'
import type {
  BackupService,
  BackupRestoreError,
  BackupRestoreSummary,
} from '../../application/backup/BackupService'
import { useServices } from '../../app/servicesContext'
import { CURRENT_BACKUP_FORMAT_VERSION } from '../../domain/shared/BackupFormatVersion'
import {
  DEFAULT_MEASUREMENT_PREFERENCE,
  DEFAULT_UI_LOCALE,
  parseMeasurementPreference,
  parseUiLocale,
  UI_LOCALES,
  UI_LOCALE_ENDONYMS,
} from '../../domain/shared/Locale'
import { type WeekStartDay } from '../../domain/shared/LocalDate'
import { formatWeekday } from '../localization/formatDate'
import { restoreErrorCopy } from '../localization/errors'
import { PageTitle } from '../components/ScreenHeader'
import { useSettings } from '../hooks/useSettings'
import { useRecipes } from '../hooks/useRecipes'
import { useTags } from '../hooks/useTags'
import { useIngredients } from '../hooks/useIngredients'
import { useLocalization } from '../localization/LocalizationContext'
import {
  DEFAULT_GENERATION_HARD_POLICY,
  mergeGenerationHardPolicy,
  missingGenerationPolicyRefs,
  type UnknownDataPolicy,
} from '../../domain/plans/generation/constraints'

interface SettingsForm {
  householdSize: number
  weekStartDay: string
  maxBatchPrepUnits: number
  preferredBatchPrepDays: string[]
  quickMealsOnlyDays: string[]
  avoidMultipleDemandingPreps: boolean
  favorVegetablesDaily: boolean
  uiLocale: string
  measurementPreference: string
  excludedRecipeIds: string[]
  requiredTagIds: string[]
  excludedTagIds: string[]
  includeIngredientIds: string[]
  excludeIngredientIds: string[]
  maxTotalTimeMinutes: number | ''
  unknownTimePolicy: UnknownDataPolicy
  unknownIngredientPolicy: UnknownDataPolicy
  generationPreferredTagIds: string[]
}

async function downloadCurrentBackup(
  backupService: BackupService,
  exportedMessage: string,
): Promise<void> {
  const backup = await backupService.createBackup()
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `planeat-backup-${dayjs().format('YYYY-MM-DD')}.json`
  link.click()
  URL.revokeObjectURL(url)
  notifications.show({ message: exportedMessage, color: 'success' })
}

function BackupCounts({ summary }: { summary: BackupRestoreSummary }) {
  const { t } = useLocalization()
  return (
    <Stack gap={4}>
      <Text size="sm">{t('settings.backupFormatOk')}</Text>
      <Text size="sm">{t('settings.backupRecipes', { count: summary.recipeCount })}</Text>
      <Text size="sm">{t('settings.backupFoods', { count: summary.simpleFoodCount })}</Text>
      <Text size="sm">{t('settings.backupPlans', { count: summary.planCount })}</Text>
      <Text size="sm">{t('settings.backupLists', { count: summary.groceryListCount })}</Text>
      {summary.exportedAtDisplay ? (
        <Text size="sm">{t('settings.backupExportedAt', { when: summary.exportedAtDisplay })}</Text>
      ) : null}
      {summary.missingGenerationRefs ? (
        <Text size="sm">
          {t('settings.backupMissingGenerationRefs', {
            recipes: summary.missingGenerationRefs.recipeCount,
            tags: summary.missingGenerationRefs.tagCount,
            ingredients: summary.missingGenerationRefs.ingredientCount,
          })}
        </Text>
      ) : null}
    </Stack>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      size="xs"
      tt="uppercase"
      fw={600}
      c="dimmed"
      style={{ letterSpacing: '0.08em' }}
      mb={8}
      mt={4}
    >
      {children}
    </Text>
  )
}

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

export function SettingsScreen() {
  const { settingsRepository, backupService } = useServices()
  const settings = useSettings()
  const recipes = useRecipes()
  const tags = useTags()
  const ingredients = useIngredients()
  const { t, bcp47 } = useLocalization()

  const weekStartOptions = ([0, 1, 2, 3, 4, 5, 6] as const).map((day) => ({
    value: String(day),
    label: formatWeekday(day, bcp47, 'long'),
  }))

  const form = useForm<SettingsForm>({
    initialValues: {
      householdSize: 2,
      weekStartDay: '1',
      maxBatchPrepUnits: 2,
      preferredBatchPrepDays: [],
      quickMealsOnlyDays: [],
      avoidMultipleDemandingPreps: true,
      favorVegetablesDaily: false,
      uiLocale: DEFAULT_UI_LOCALE,
      measurementPreference: DEFAULT_MEASUREMENT_PREFERENCE,
      excludedRecipeIds: [],
      requiredTagIds: [],
      excludedTagIds: [],
      includeIngredientIds: [],
      excludeIngredientIds: [],
      maxTotalTimeMinutes: '',
      unknownTimePolicy: DEFAULT_GENERATION_HARD_POLICY.unknownTimePolicy,
      unknownIngredientPolicy: DEFAULT_GENERATION_HARD_POLICY.unknownIngredientPolicy,
      generationPreferredTagIds: [],
    },
  })

  const preferredPrepDaysKey = settings?.preferredBatchPrepDays.join(',') ?? ''
  const quickMealsDaysKey = settings?.quickMealsOnlyDays.join(',') ?? ''
  const policy = settings?.generationHardPolicy
  const policyKey = policy ? JSON.stringify(mergeGenerationHardPolicy(policy)) : ''
  const preferredTagsKey = settings?.generationPreferredTagIds.join(',') ?? ''

  useEffect(() => {
    if (!settings) return
    form.setValues({
      householdSize: settings.householdSize,
      weekStartDay: String(settings.weekStartDay),
      maxBatchPrepUnits: settings.maxBatchPrepUnits,
      preferredBatchPrepDays: settings.preferredBatchPrepDays.map(String),
      quickMealsOnlyDays: settings.quickMealsOnlyDays.map(String),
      avoidMultipleDemandingPreps: settings.avoidMultipleDemandingPreps,
      favorVegetablesDaily: settings.favorVegetablesDaily,
      uiLocale: settings.uiLocale,
      measurementPreference: settings.measurementPreference,
      excludedRecipeIds: [...settings.generationHardPolicy.excludedRecipeIds],
      requiredTagIds: [...settings.generationHardPolicy.requiredTagIds],
      excludedTagIds: [...settings.generationHardPolicy.excludedTagIds],
      includeIngredientIds: [...settings.generationHardPolicy.includeIngredientIds],
      excludeIngredientIds: [...settings.generationHardPolicy.excludeIngredientIds],
      maxTotalTimeMinutes: settings.generationHardPolicy.maxTotalTimeMinutes ?? '',
      unknownTimePolicy: settings.generationHardPolicy.unknownTimePolicy,
      unknownIngredientPolicy: settings.generationHardPolicy.unknownIngredientPolicy,
      generationPreferredTagIds: [...settings.generationPreferredTagIds],
    })
    // Hydrate from stored fields, not the liveQuery object identity (a new
    // mergeSettingsDefaults result every emit would retrigger setValues forever).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    preferredPrepDaysKey,
    quickMealsDaysKey,
    settings?.householdSize,
    settings?.weekStartDay,
    settings?.maxBatchPrepUnits,
    settings?.avoidMultipleDemandingPreps,
    settings?.favorVegetablesDaily,
    settings?.uiLocale,
    settings?.measurementPreference,
    policyKey,
    preferredTagsKey,
  ])

  const handleSubmit = form.onSubmit(async (values) => {
    const weekStartDay = Number(values.weekStartDay) as WeekStartDay
    await settingsRepository.update({
      householdSize: values.householdSize,
      weekStartDay,
      maxBatchPrepUnits: values.maxBatchPrepUnits,
      preferredBatchPrepDays: values.preferredBatchPrepDays.map(Number) as WeekStartDay[],
      quickMealsOnlyDays: values.quickMealsOnlyDays.map(Number) as WeekStartDay[],
      avoidMultipleDemandingPreps: values.avoidMultipleDemandingPreps,
      favorVegetablesDaily: values.favorVegetablesDaily,
      uiLocale: parseUiLocale(values.uiLocale),
      measurementPreference: parseMeasurementPreference(values.measurementPreference),
      generationHardPolicy: mergeGenerationHardPolicy({
        excludedRecipeIds: values.excludedRecipeIds,
        requiredTagIds: values.requiredTagIds,
        excludedTagIds: values.excludedTagIds,
        includeIngredientIds: values.includeIngredientIds,
        excludeIngredientIds: values.excludeIngredientIds,
        maxTotalTimeMinutes:
          values.maxTotalTimeMinutes === '' ? undefined : values.maxTotalTimeMinutes,
        unknownTimePolicy: values.unknownTimePolicy,
        unknownIngredientPolicy: values.unknownIngredientPolicy,
      }),
      generationPreferredTagIds: values.generationPreferredTagIds,
    })
    notifications.show({ message: t('settings.saved'), color: 'success' })
  })

  const handleExport = () => void downloadCurrentBackup(backupService, t('settings.backupExported'))

  const restoreMessage = (error: BackupRestoreError, found?: number) =>
    restoreErrorCopy(t, error, found, CURRENT_BACKUP_FORMAT_VERSION)

  const showRestoreSuccess = (summary: BackupRestoreSummary) => {
    modals.open({
      title: t('settings.restoredTitle'),
      children: (
        <Stack gap="sm">
          <Text size="sm">{t('settings.restoredBody')}</Text>
          <BackupCounts summary={summary} />
          <Button onClick={() => modals.closeAll()}>{t('action.ok')}</Button>
        </Stack>
      ),
    })
  }

  const restoreBackup = async (parsed: unknown) => {
    const result = await backupService.restoreBackup(parsed, bcp47)
    if (!result.ok) {
      notifications.show({
        message: restoreMessage(result.error, result.foundVersion),
        color: 'error',
      })
      return
    }
    modals.closeAll()
    showRestoreSuccess(result.summary)
  }

  const recipeOptions = (recipes ?? []).map((recipe) => ({ value: recipe.id, label: recipe.name }))
  const tagOptions = (tags ?? []).map((tag) => ({ value: tag.id, label: tag.name }))
  const ingredientOptions = (ingredients ?? []).map((ingredient) => ({
    value: ingredient.id,
    label: ingredient.name,
  }))
  const unknownPolicyOptions = [
    { value: 'exclude', label: t('settings.unknownExclude') },
    { value: 'allow', label: t('settings.unknownAllow') },
  ]
  const liveMissing = missingGenerationPolicyRefs(
    mergeGenerationHardPolicy({
      excludedRecipeIds: form.values.excludedRecipeIds,
      requiredTagIds: form.values.requiredTagIds,
      excludedTagIds: form.values.excludedTagIds,
      includeIngredientIds: form.values.includeIngredientIds,
      excludeIngredientIds: form.values.excludeIngredientIds,
      maxTotalTimeMinutes:
        form.values.maxTotalTimeMinutes === '' ? undefined : form.values.maxTotalTimeMinutes,
      unknownTimePolicy: form.values.unknownTimePolicy,
      unknownIngredientPolicy: form.values.unknownIngredientPolicy,
    }),
    {
      recipeIds: (recipes ?? []).map((recipe) => recipe.id),
      tagIds: (tags ?? []).map((tag) => tag.id),
      ingredientIds: (ingredients ?? []).map((ingredient) => ingredient.id),
    },
    form.values.generationPreferredTagIds,
  )
  const missingRefCount =
    liveMissing.recipeIds.length + liveMissing.tagIds.length + liveMissing.ingredientIds.length

  const handleFilePicked = async (file: File | null) => {
    if (!file) return
    let parsed: unknown
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      notifications.show({ message: t('settings.invalidJson'), color: 'error' })
      return
    }

    const inspected = backupService.inspectBackup(parsed, bcp47)
    if (!inspected.ok) {
      notifications.show({
        message: restoreMessage(inspected.error, inspected.foundVersion),
        color: 'error',
      })
      return
    }

    modals.open({
      title: t('settings.restoreTitle'),
      children: (
        <Stack gap="sm">
          <BackupCounts summary={inspected.summary} />
          <Text size="sm">{t('settings.restoreReplaceHelp')}</Text>
          <Button
            variant="default"
            onClick={() => void downloadCurrentBackup(backupService, t('settings.backupExported'))}
          >
            {t('settings.exportCurrent')}
          </Button>
          <Group justify="space-between">
            <Button variant="default" onClick={() => modals.closeAll()}>
              {t('action.cancel')}
            </Button>
            <Button color="error" onClick={() => void restoreBackup(parsed)}>
              {t('settings.replaceRestore')}
            </Button>
          </Group>
        </Stack>
      ),
    })
  }

  return (
    <Stack gap="lg">
      <PageTitle>{t('settings.title')}</PageTitle>

      <form onSubmit={handleSubmit}>
        <Stack gap={24}>
          <div>
            <SectionLabel>{t('settings.sectionDisplay')}</SectionLabel>
            <Paper withBorder p={12} radius="md">
              <Stack gap="sm">
                <Select
                  label={t('settings.language')}
                  data={UI_LOCALES.map((locale) => ({
                    value: locale,
                    label: UI_LOCALE_ENDONYMS[locale],
                  }))}
                  disabled={!settings}
                  allowDeselect={false}
                  {...form.getInputProps('uiLocale')}
                />
                <Select
                  label={t('settings.measurement')}
                  description={t('settings.measurementHelp')}
                  data={[
                    { value: 'as-entered', label: t('settings.measurementAsEntered') },
                    { value: 'metric', label: t('settings.measurementMetric') },
                    { value: 'us-customary', label: t('settings.measurementUs') },
                  ]}
                  disabled={!settings}
                  allowDeselect={false}
                  {...form.getInputProps('measurementPreference')}
                />
              </Stack>
            </Paper>
          </div>

          <div>
            <SectionLabel>{t('settings.sectionHousehold')}</SectionLabel>
            <Paper withBorder p={12} radius="md">
              <Stack gap="sm">
                <NumberInput
                  label={t('settings.householdSize')}
                  min={1}
                  disabled={!settings}
                  {...form.getInputProps('householdSize')}
                />
                <Select
                  label={t('settings.weekStartsOn')}
                  data={weekStartOptions}
                  disabled={!settings}
                  {...form.getInputProps('weekStartDay')}
                />
              </Stack>
            </Paper>
          </div>

          <div>
            <SectionLabel>{t('settings.sectionPrefs')}</SectionLabel>
            <Paper withBorder p={12} radius="md">
              <Stack gap="sm">
                <NumberInput
                  label={t('settings.maxBatchPrep')}
                  description={t('settings.maxBatchPrepHelp')}
                  min={0.5}
                  step={0.5}
                  decimalScale={1}
                  disabled={!settings}
                  {...form.getInputProps('maxBatchPrepUnits')}
                />
                <MultiSelect
                  label={t('settings.preferredPrepDays')}
                  data={weekStartOptions}
                  disabled={!settings}
                  {...form.getInputProps('preferredBatchPrepDays')}
                />
                <MultiSelect
                  label={t('settings.quickMealsDays')}
                  data={weekStartOptions}
                  disabled={!settings}
                  {...form.getInputProps('quickMealsOnlyDays')}
                />
                <Switch
                  label={t('settings.avoidDemanding')}
                  disabled={!settings}
                  {...form.getInputProps('avoidMultipleDemandingPreps', { type: 'checkbox' })}
                />
                <Switch
                  label={t('settings.favorVegetables')}
                  disabled={!settings}
                  {...form.getInputProps('favorVegetablesDaily', { type: 'checkbox' })}
                />
                <MultiSelect
                  label={t('settings.generationPreferredTags')}
                  description={t('settings.generationPreferredTagsHelp')}
                  searchable
                  disabled={!settings}
                  data={selectDataWithExtras(
                    tagOptions,
                    form.values.generationPreferredTagIds,
                    t('common.unavailableTag'),
                  )}
                  {...form.getInputProps('generationPreferredTagIds')}
                />
              </Stack>
            </Paper>
          </div>

          <div>
            <SectionLabel>{t('settings.sectionGeneration')}</SectionLabel>
            <Paper withBorder p={12} radius="md">
              <Stack gap="sm">
                <Text size="sm" c="dimmed">
                  {t('settings.generationHelp')}
                </Text>
                <MultiSelect
                  label={t('settings.excludedRecipes')}
                  searchable
                  disabled={!settings}
                  data={selectDataWithExtras(
                    recipeOptions,
                    form.values.excludedRecipeIds,
                    t('common.unknownItem'),
                  )}
                  {...form.getInputProps('excludedRecipeIds')}
                />
                <MultiSelect
                  label={t('settings.requiredTags')}
                  searchable
                  disabled={!settings}
                  data={selectDataWithExtras(
                    tagOptions,
                    form.values.requiredTagIds,
                    t('common.unavailableTag'),
                  )}
                  {...form.getInputProps('requiredTagIds')}
                />
                <MultiSelect
                  label={t('settings.excludedTags')}
                  searchable
                  disabled={!settings}
                  data={selectDataWithExtras(
                    tagOptions,
                    form.values.excludedTagIds,
                    t('common.unavailableTag'),
                  )}
                  {...form.getInputProps('excludedTagIds')}
                />
                <MultiSelect
                  label={t('settings.includeIngredients')}
                  searchable
                  disabled={!settings}
                  data={selectDataWithExtras(
                    ingredientOptions,
                    form.values.includeIngredientIds,
                    t('common.unavailableIngredient'),
                  )}
                  {...form.getInputProps('includeIngredientIds')}
                />
                <MultiSelect
                  label={t('settings.excludeIngredients')}
                  searchable
                  disabled={!settings}
                  data={selectDataWithExtras(
                    ingredientOptions,
                    form.values.excludeIngredientIds,
                    t('common.unavailableIngredient'),
                  )}
                  {...form.getInputProps('excludeIngredientIds')}
                />
                <NumberInput
                  label={t('settings.maxTotalTime')}
                  description={t('settings.maxTotalTimeHelp')}
                  min={1}
                  disabled={!settings}
                  {...form.getInputProps('maxTotalTimeMinutes')}
                />
                <Select
                  label={t('settings.unknownTime')}
                  data={unknownPolicyOptions}
                  disabled={!settings}
                  allowDeselect={false}
                  {...form.getInputProps('unknownTimePolicy')}
                />
                <Select
                  label={t('settings.unknownIngredients')}
                  data={unknownPolicyOptions}
                  disabled={!settings}
                  allowDeselect={false}
                  {...form.getInputProps('unknownIngredientPolicy')}
                />
                {missingRefCount > 0 && (
                  <Text size="sm" c="dimmed">
                    {t('settings.missingGenerationRefs', {
                      recipes: liveMissing.recipeIds.length,
                      tags: liveMissing.tagIds.length,
                      ingredients: liveMissing.ingredientIds.length,
                    })}
                  </Text>
                )}
              </Stack>
            </Paper>
          </div>

          <Button type="submit" disabled={!settings} w="fit-content">
            {t('action.save')}
          </Button>
        </Stack>
      </form>

      <div>
        <SectionLabel>{t('settings.sectionBackup')}</SectionLabel>
        <Paper withBorder p={12} radius="md">
          <Stack gap="sm">
            <Text c="dimmed" size="sm">
              {t('settings.backupHelp')}
            </Text>
            <Text c="dimmed" size="sm">
              {t('settings.backupPhotos')}
            </Text>
            <Group>
              <Button variant="default" onClick={handleExport}>
                {t('settings.exportBackup')}
              </Button>
              <FileButton onChange={handleFilePicked} accept="application/json">
                {(props) => (
                  <Button variant="default" {...props}>
                    {t('settings.restoreBackup')}
                  </Button>
                )}
              </FileButton>
            </Group>
          </Stack>
        </Paper>
      </div>
    </Stack>
  )
}
