import {
  Title,
  Text,
  Stack,
  NumberInput,
  Button,
  Group,
  Divider,
  FileButton,
  Select,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import dayjs from 'dayjs'
import { useEffect } from 'react'
import { useServices } from '../../app/servicesContext'
import { WEEKDAY_LABELS, type WeekStartDay } from '../../domain/shared/LocalDate'
import { useSettings } from '../hooks/useSettings'

interface SettingsForm {
  householdSize: number
  weekStartDay: string
}

const weekStartOptions = ([0, 1, 2, 3, 4, 5, 6] as const).map((day) => ({
  value: String(day),
  label: WEEKDAY_LABELS[day],
}))

export function SettingsScreen() {
  const { settingsRepository, backupService } = useServices()
  const settings = useSettings()

  const form = useForm<SettingsForm>({
    initialValues: { householdSize: 2, weekStartDay: '1' },
  })

  useEffect(() => {
    if (settings) {
      form.setValues({
        householdSize: settings.householdSize,
        weekStartDay: String(settings.weekStartDay),
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings])

  const handleSubmit = form.onSubmit(async (values) => {
    const weekStartDay = Number(values.weekStartDay) as WeekStartDay
    await settingsRepository.update({
      householdSize: values.householdSize,
      weekStartDay,
    })
    notifications.show({ message: 'Settings saved', color: 'green' })
  })

  const handleExport = async () => {
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

  const restoreBackup = async (parsed: unknown) => {
    try {
      await backupService.restoreBackup(parsed)
      notifications.show({ message: 'Backup restored', color: 'green' })
    } catch (error) {
      notifications.show({
        message: error instanceof Error ? error.message : 'Could not restore backup',
        color: 'red',
      })
    }
  }

  // Centralized via @mantine/modals so every "replace/remove existing data" confirmation
  // in the app (backups, recipe deletion, dependent-meal edits, list overwrites) shares one pattern.
  const handleFilePicked = async (file: File | null) => {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      modals.openConfirmModal({
        title: 'Restore backup',
        children: (
          <Text>
            This replaces all local recipes, ingredients, simple foods, meal plans, and settings
            with the contents of this file. Continue?
          </Text>
        ),
        labels: { confirm: 'Replace local data', cancel: 'Cancel' },
        confirmProps: { color: 'red' },
        onConfirm: () => restoreBackup(parsed),
      })
    } catch {
      notifications.show({ message: 'That file is not valid JSON', color: 'red' })
    }
  }

  return (
    <Stack gap="md">
      <Title order={2}>Settings</Title>

      <form onSubmit={handleSubmit}>
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
          <Button type="submit" disabled={!settings} w="fit-content">
            Save
          </Button>
        </Stack>
      </form>

      <Divider label="Backup" labelPosition="left" />

      <Text c="dimmed" size="sm">
        Export a backup file, or restore one — restoring replaces all local data.
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
  )
}
