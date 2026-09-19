import { Button, Group, Menu, Modal, Text, TextInput } from '@mantine/core'
import { modals } from '@mantine/modals'
import { BookmarkSimple, CaretDown, Check } from '@phosphor-icons/react'
import { useState } from 'react'
import {
  BUILTIN_GENERATION_PRESETS,
  isBuiltinGenerationPresetId,
} from '../../domain/plans/generation/GenerationConfig'
import type { GenerationPreset } from '../../domain/generationPresets/GenerationPreset'
import { useLocalization } from '../localization/LocalizationContext'
import type { MessageId } from '../localization/messages'

const BUILTIN_NAME_IDS: Record<string, MessageId> = {
  'preset:balanced': 'generation.preset.balanced',
  'preset:less-cooking': 'generation.preset.lessCooking',
  'preset:more-variety': 'generation.preset.moreVariety',
  'preset:batch-cooking': 'generation.preset.batchCooking',
}

export function GenerationPresetsBar({
  presets,
  loadedPresetId,
  dirty,
  onSelectPreset,
  onSaveAsNew,
  onUpdate,
  onRename,
  onDelete,
}: {
  presets: GenerationPreset[]
  loadedPresetId: string | null
  dirty: boolean
  onSelectPreset: (id: string | null) => void
  onSaveAsNew: (name: string) => Promise<boolean>
  onUpdate: () => Promise<boolean>
  onRename: (name: string) => Promise<boolean>
  onDelete: () => Promise<void>
}) {
  const { t } = useLocalization()
  const builtin = loadedPresetId ? isBuiltinGenerationPresetId(loadedPresetId) : false
  const loadedCustom = presets.find((preset) => preset.id === loadedPresetId)
  const loadedName = loadedPresetId
    ? builtin
      ? t(BUILTIN_NAME_IDS[loadedPresetId] ?? 'generation.preset')
      : (loadedCustom?.name ?? t('generation.preset'))
    : t('generation.presetHousehold')
  const [dialog, setDialog] = useState<'save' | 'rename' | null>(null)
  const [nameDraft, setNameDraft] = useState('')

  const openSave = () => {
    setNameDraft('')
    setDialog('save')
  }

  const openRename = () => {
    if (!loadedCustom) return
    setNameDraft(loadedCustom.name)
    setDialog('rename')
  }

  const confirmName = async () => {
    const ok =
      dialog === 'save'
        ? await onSaveAsNew(nameDraft)
        : dialog === 'rename'
          ? await onRename(nameDraft)
          : false
    if (ok) setDialog(null)
  }

  const confirmDelete = () => {
    if (!loadedCustom) return
    modals.openConfirmModal({
      title: t('generation.deletePresetTitle', { name: loadedCustom.name }),
      children: <Text>{t('generation.deletePresetBody')}</Text>,
      labels: { confirm: t('generation.deletePreset'), cancel: t('action.cancel') },
      confirmProps: { color: 'error' },
      onConfirm: () => {
        void onDelete()
      },
    })
  }

  const triggerLabel = dirty ? t('library.unsavedSuffix', { name: loadedName }) : loadedName
  const canUpdate = Boolean(loadedCustom && dirty && !builtin)
  const canRenameOrDelete = Boolean(loadedCustom && !builtin)

  return (
    <>
      <Menu shadow="md" position="bottom-start" width={260}>
        <Menu.Target>
          <Button
            type="button"
            size="compact-sm"
            variant="default"
            radius="md"
            leftSection={<BookmarkSimple size={14} />}
            rightSection={<CaretDown size={12} />}
            aria-label={t('generation.preset')}
          >
            {triggerLabel}
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            onClick={() => onSelectPreset(null)}
            leftSection={!loadedPresetId ? <Check size={14} /> : undefined}
          >
            {t('generation.presetHousehold')}
          </Menu.Item>
          <Menu.Divider />
          <Menu.Label>{t('generation.builtinPresets')}</Menu.Label>
          {BUILTIN_GENERATION_PRESETS.map((preset) => (
            <Menu.Item
              key={preset.id}
              onClick={() => onSelectPreset(preset.id)}
              leftSection={preset.id === loadedPresetId ? <Check size={14} /> : undefined}
            >
              {preset.id === loadedPresetId && dirty
                ? t('library.unsavedSuffix', { name: t(BUILTIN_NAME_IDS[preset.id]) })
                : t(BUILTIN_NAME_IDS[preset.id])}
            </Menu.Item>
          ))}
          {presets.length > 0 && (
            <>
              <Menu.Divider />
              <Menu.Label>{t('generation.customPresets')}</Menu.Label>
              {presets.map((preset) => (
                <Menu.Item
                  key={preset.id}
                  onClick={() => onSelectPreset(preset.id)}
                  leftSection={preset.id === loadedPresetId ? <Check size={14} /> : undefined}
                >
                  {preset.id === loadedPresetId && dirty
                    ? t('library.unsavedSuffix', { name: preset.name })
                    : preset.name}
                </Menu.Item>
              ))}
            </>
          )}
          <Menu.Divider />
          {dirty && <Menu.Label>{t('library.unsaved')}</Menu.Label>}
          <Menu.Item disabled={!canUpdate} onClick={() => void onUpdate()}>
            {t('generation.updatePreset')}
          </Menu.Item>
          <Menu.Item onClick={openSave}>{t('generation.savePresetAsNew')}</Menu.Item>
          <Menu.Item disabled={!canRenameOrDelete} onClick={openRename}>
            {t('action.rename')}
          </Menu.Item>
          <Menu.Item disabled={!canRenameOrDelete} color="error" onClick={confirmDelete}>
            {t('action.delete')}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <Modal
        opened={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog === 'rename' ? t('generation.renamePreset') : t('generation.savePresetTitle')}
      >
        <TextInput
          label={t('common.name')}
          placeholder={t('generation.presetNamePlaceholder')}
          value={nameDraft}
          onChange={(event) => setNameDraft(event.currentTarget.value)}
          data-autofocus
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setDialog(null)}>
            {t('action.cancel')}
          </Button>
          <Button onClick={() => void confirmName()}>{t('action.save')}</Button>
        </Group>
      </Modal>
    </>
  )
}
