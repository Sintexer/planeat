import { Button, Group, Modal, Select, Text, TextInput } from '@mantine/core'
import { modals } from '@mantine/modals'
import { useState } from 'react'
import type { LibraryView, LibraryViewId } from '../../domain/libraryViews/LibraryView'
import { useLocalization } from '../localization/LocalizationContext'

export function LibraryViewsBar({
  views,
  loadedViewId,
  dirty,
  onSelectView,
  onSaveAsNew,
  onUpdate,
  onRename,
  onDelete,
}: {
  views: LibraryView[]
  loadedViewId: LibraryViewId | null
  dirty: boolean
  onSelectView: (id: LibraryViewId | null) => void
  onSaveAsNew: (name: string) => Promise<boolean>
  onUpdate: () => Promise<boolean>
  onRename: (name: string) => Promise<boolean>
  onDelete: () => Promise<void>
}) {
  const { t } = useLocalization()
  const loaded = views.find((view) => view.id === loadedViewId)
  const [dialog, setDialog] = useState<'save' | 'rename' | null>(null)
  const [nameDraft, setNameDraft] = useState('')

  const openSave = () => {
    setNameDraft('')
    setDialog('save')
  }

  const openRename = () => {
    if (!loaded) return
    setNameDraft(loaded.name)
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
    if (!loaded) return
    modals.openConfirmModal({
      title: t('library.deleteViewTitle', { name: loaded.name }),
      children: <Text>{t('library.deleteViewBody')}</Text>,
      labels: { confirm: t('library.deleteView'), cancel: t('action.cancel') },
      confirmProps: { color: 'error' },
      onConfirm: () => {
        void onDelete()
      },
    })
  }

  return (
    <>
      <Group gap="xs" wrap="wrap" align="flex-end">
        <Select
          size="xs"
          w={180}
          label={t('library.savedView')}
          placeholder={t('common.none')}
          clearable
          data={views.map((view) => ({
            value: view.id,
            label:
              view.id === loadedViewId && dirty
                ? t('library.unsavedSuffix', { name: view.name })
                : view.name,
          }))}
          value={loadedViewId}
          onChange={(value) => onSelectView(value)}
          aria-label={t('library.savedView')}
        />
        {loaded && dirty && (
          <Text size="xs" c="orange" mb={6}>
            {t('library.unsaved')}
          </Text>
        )}
        <Button
          size="compact-xs"
          variant="default"
          disabled={!loaded || !dirty}
          onClick={() => {
            void onUpdate()
          }}
        >
          {t('library.updateView')}
        </Button>
        <Button size="compact-xs" variant="light" onClick={openSave}>
          {t('library.saveAsNew')}
        </Button>
        <Button size="compact-xs" variant="subtle" disabled={!loaded} onClick={openRename}>
          {t('action.rename')}
        </Button>
        <Button
          size="compact-xs"
          variant="subtle"
          color="error"
          disabled={!loaded}
          onClick={confirmDelete}
        >
          {t('action.delete')}
        </Button>
      </Group>

      <Modal
        opened={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog === 'rename' ? t('library.renameView') : t('library.saveAsNewTitle')}
      >
        <TextInput
          label={t('common.name')}
          placeholder={t('library.viewNamePlaceholder')}
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
