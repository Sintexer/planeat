import { Button, Group, Menu, Modal, Text, TextInput } from '@mantine/core'
import { modals } from '@mantine/modals'
import { BookmarkSimple, CaretDown, Check } from '@phosphor-icons/react'
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

  const triggerLabel = loaded
    ? dirty
      ? t('library.unsavedSuffix', { name: loaded.name })
      : loaded.name
    : t('library.savedView')

  return (
    <>
      <Menu shadow="md" position="bottom-start" width={240}>
        <Menu.Target>
          <Button
            type="button"
            size="compact-sm"
            variant="default"
            radius="md"
            leftSection={<BookmarkSimple size={14} />}
            rightSection={<CaretDown size={12} />}
            aria-label={t('library.savedView')}
          >
            {triggerLabel}
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            onClick={() => onSelectView(null)}
            leftSection={!loaded ? <Check size={14} /> : undefined}
          >
            {t('common.none')}
          </Menu.Item>
          {views.length > 0 && <Menu.Divider />}
          {views.map((view) => (
            <Menu.Item
              key={view.id}
              onClick={() => onSelectView(view.id)}
              leftSection={view.id === loadedViewId ? <Check size={14} /> : undefined}
            >
              {view.id === loadedViewId && dirty
                ? t('library.unsavedSuffix', { name: view.name })
                : view.name}
            </Menu.Item>
          ))}
          <Menu.Divider />
          {dirty && <Menu.Label>{t('library.unsaved')}</Menu.Label>}
          <Menu.Item disabled={!loaded || !dirty} onClick={() => void onUpdate()}>
            {t('library.updateView')}
          </Menu.Item>
          <Menu.Item onClick={openSave}>{t('library.saveAsNew')}</Menu.Item>
          <Menu.Item disabled={!loaded} onClick={openRename}>
            {t('action.rename')}
          </Menu.Item>
          <Menu.Item disabled={!loaded} color="error" onClick={confirmDelete}>
            {t('action.delete')}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

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
