import { Button, Group, Modal, Select, Text, TextInput } from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import type { LibraryView, LibraryViewId } from '../../domain/libraryViews/LibraryView'

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
  onUpdate: () => Promise<void>
  onRename: (name: string) => Promise<boolean>
  onDelete: () => Promise<void>
}) {
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
      title: `Delete “${loaded.name}”?`,
      children: (
        <Text>
          This removes the saved view only. Recipes stay, and the current filters are left as they
          are.
        </Text>
      ),
      labels: { confirm: 'Delete view', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
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
          label="Saved view"
          placeholder="None"
          clearable
          data={views.map((view) => ({
            value: view.id,
            label: view.id === loadedViewId && dirty ? `${view.name} (unsaved)` : view.name,
          }))}
          value={loadedViewId}
          onChange={(value) => onSelectView(value)}
          aria-label="Saved view"
        />
        {loaded && dirty && (
          <Text size="xs" c="orange" mb={6}>
            Unsaved changes
          </Text>
        )}
        <Button
          size="compact-xs"
          variant="default"
          disabled={!loaded || !dirty}
          onClick={() => {
            void onUpdate().then(() => {
              notifications.show({ message: 'View updated', color: 'green' })
            })
          }}
        >
          Update view
        </Button>
        <Button size="compact-xs" variant="light" onClick={openSave}>
          Save as new
        </Button>
        <Button size="compact-xs" variant="subtle" disabled={!loaded} onClick={openRename}>
          Rename
        </Button>
        <Button
          size="compact-xs"
          variant="subtle"
          color="red"
          disabled={!loaded}
          onClick={confirmDelete}
        >
          Delete
        </Button>
      </Group>

      <Modal
        opened={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog === 'rename' ? 'Rename view' : 'Save as new view'}
      >
        <TextInput
          label="Name"
          placeholder="Kids lunch"
          value={nameDraft}
          onChange={(event) => setNameDraft(event.currentTarget.value)}
          data-autofocus
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setDialog(null)}>
            Cancel
          </Button>
          <Button onClick={() => void confirmName()}>Save</Button>
        </Group>
      </Modal>
    </>
  )
}
