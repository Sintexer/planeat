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
} from '../../domain/shared/Locale'
import { WEEKDAY_LABELS, type WeekStartDay } from '../../domain/shared/LocalDate'
import { PageTitle } from '../components/ScreenHeader'
import { useSettings } from '../hooks/useSettings'
import { useLocalization } from '../localization/LocalizationContext'

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
}

const weekStartOptions = ([0, 1, 2, 3, 4, 5, 6] as const).map((day) => ({
  value: String(day),
  label: WEEKDAY_LABELS[day],
}))

const weekdayMultiOptions = weekStartOptions

async function downloadCurrentBackup(backupService: BackupService): Promise<void> {
  const backup = await backupService.createBackup()
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `planeat-backup-${dayjs().format('YYYY-MM-DD')}.json`
  link.click()
  URL.revokeObjectURL(url)
  notifications.show({ message: 'Backup exported', color: 'green' })
}

function restoreErrorMessage(error: BackupRestoreError, foundVersion?: number): string {
  if (error === 'unsupported-version') {
    const found = foundVersion === undefined ? 'unknown' : String(foundVersion)
    return `This backup uses format version ${found}. This app supports version ${CURRENT_BACKUP_FORMAT_VERSION}. The household data on this device was not changed.`
  }
  if (error === 'write-failed') {
    return 'Could not restore backup: local data was not modified.'
  }
  return 'This file is not a valid PlanEat backup. The household data on this device was not changed.'
}

function BackupCounts({ summary }: { summary: BackupRestoreSummary }) {
  return (
    <Stack gap={4}>
      <Text size="sm">Backup format: supported</Text>
      <Text size="sm">Recipes: {summary.recipeCount}</Text>
      <Text size="sm">Simple foods: {summary.simpleFoodCount}</Text>
      <Text size="sm">Meal plans: {summary.planCount}</Text>
      <Text size="sm">Grocery lists: {summary.groceryListCount}</Text>
      {summary.exportedAtDisplay ? (
        <Text size="sm">Exported: {summary.exportedAtDisplay}</Text>
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

export function SettingsScreen() {
  const { settingsRepository, backupService } = useServices()
  const settings = useSettings()
  const { t } = useLocalization()

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
    },
  })

  useEffect(() => {
    if (settings) {
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
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings])

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
    })
    notifications.show({ message: 'Settings saved', color: 'green' })
  })

  const handleExport = () => downloadCurrentBackup(backupService)

  const showRestoreSuccess = (summary: BackupRestoreSummary) => {
    modals.open({
      title: 'Backup restored',
      children: (
        <Stack gap="sm">
          <Text size="sm">This device now has the household data from the backup.</Text>
          <BackupCounts summary={summary} />
          <Button onClick={() => modals.closeAll()}>OK</Button>
        </Stack>
      ),
    })
  }

  const restoreBackup = async (parsed: unknown) => {
    const result = await backupService.restoreBackup(parsed)
    if (!result.ok) {
      notifications.show({
        message: restoreErrorMessage(result.error, result.foundVersion),
        color: 'red',
      })
      return
    }
    modals.closeAll()
    showRestoreSuccess(result.summary)
  }

  const handleFilePicked = async (file: File | null) => {
    if (!file) return
    let parsed: unknown
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      notifications.show({ message: 'That file is not valid JSON', color: 'red' })
      return
    }

    const inspected = backupService.inspectBackup(parsed)
    if (!inspected.ok) {
      notifications.show({
        message: restoreErrorMessage(inspected.error, inspected.foundVersion),
        color: 'red',
      })
      return
    }

    modals.open({
      title: 'Restore this backup?',
      children: (
        <Stack gap="sm">
          <BackupCounts summary={inspected.summary} />
          <Text size="sm">This will replace the household data on this device.</Text>
          <Button variant="default" onClick={() => void downloadCurrentBackup(backupService)}>
            Export current data
          </Button>
          <Group justify="space-between">
            <Button variant="default" onClick={() => modals.closeAll()}>
              Cancel
            </Button>
            <Button color="red" onClick={() => void restoreBackup(parsed)}>
              Replace and restore
            </Button>
          </Group>
        </Stack>
      ),
    })
  }

  return (
    <Stack gap="lg">
      <PageTitle>Settings</PageTitle>

      <form onSubmit={handleSubmit}>
        <Stack gap={24}>
          <div>
            <SectionLabel>Display</SectionLabel>
            <Paper withBorder p={12} radius="md">
              <Stack gap="sm">
                <Select
                  label={t('settings.language')}
                  data={[{ value: 'en', label: 'English' }]}
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
            <SectionLabel>Household</SectionLabel>
            <Paper withBorder p={12} radius="md">
              <Stack gap="sm">
                <NumberInput
                  label="Household size"
                  min={1}
                  disabled={!settings}
                  {...form.getInputProps('householdSize')}
                />
                <Select
                  label="Week starts on"
                  data={weekStartOptions}
                  disabled={!settings}
                  {...form.getInputProps('weekStartDay')}
                />
              </Stack>
            </Paper>
          </div>

          <div>
            <SectionLabel>Meal preferences</SectionLabel>
            <Paper withBorder p={12} radius="md">
              <Stack gap="sm">
                <NumberInput
                  label="Maximum batch-prep units"
                  description="Half-unit steps. Two dishes in one session count as 1.5."
                  min={0.5}
                  step={0.5}
                  decimalScale={1}
                  disabled={!settings}
                  {...form.getInputProps('maxBatchPrepUnits')}
                />
                <MultiSelect
                  label="Preferred batch-prep days"
                  data={weekdayMultiOptions}
                  disabled={!settings}
                  {...form.getInputProps('preferredBatchPrepDays')}
                />
                <MultiSelect
                  label="Quick-meals-only days"
                  data={weekdayMultiOptions}
                  disabled={!settings}
                  {...form.getInputProps('quickMealsOnlyDays')}
                />
                <Switch
                  label="Avoid multiple demanding preparations on one day"
                  disabled={!settings}
                  {...form.getInputProps('avoidMultipleDemandingPreps', { type: 'checkbox' })}
                />
                <Switch
                  label="Favor vegetables daily"
                  disabled={!settings}
                  {...form.getInputProps('favorVegetablesDaily', { type: 'checkbox' })}
                />
              </Stack>
            </Paper>
          </div>

          <Button type="submit" disabled={!settings} w="fit-content">
            Save
          </Button>
        </Stack>
      </form>

      <div>
        <SectionLabel>Backup</SectionLabel>
        <Paper withBorder p={12} radius="md">
          <Stack gap="sm">
            <Text c="dimmed" size="sm">
              Export a backup file, or restore one. Restore shows what the file contains first and
              replaces all local data only after you confirm.
            </Text>
            <Text c="dimmed" size="sm">
              {t('settings.backupPhotos')}
            </Text>
            <Group>
              <Button variant="default" onClick={handleExport}>
                Export backup
              </Button>
              <FileButton onChange={handleFilePicked} accept="application/json">
                {(props) => (
                  <Button variant="default" {...props}>
                    Restore from backup
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
