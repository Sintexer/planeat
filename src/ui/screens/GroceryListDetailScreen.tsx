import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Group,
  Stack,
  Text,
  TextInput,
  Loader,
  SegmentedControl,
  Switch,
  Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { IconPencil, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useServices } from '../../app/servicesContext'
import type { GroceryItem } from '../../domain/groceries/GroceryItem'
import { groceryListView, shoppingSectionLabel } from '../../domain/groceries/shoppingSections'
import type { Quantity } from '../../domain/shared/Quantity'
import { QuantityFields } from '../components/QuantityFields'
import { ScreenHeader } from '../components/ScreenHeader'
import { ShoppingSectionSelect } from '../components/ShoppingSectionSelect'
import { useGroceryList } from '../hooks/useGroceryList'
import { useFormatQuantity } from '../localization/useFormatQuantity'

interface ManualItemForm {
  label: string
  quantityValue: number | ''
  quantityUnit: string
  shoppingSection: string
}

interface EditItemForm {
  label: string
  quantityValue: number | ''
  quantityUnit: string
  shoppingSection: string
}

function quantityFromForm(value: number | '', unit: string): Quantity | null {
  if (value === '' || !Number.isFinite(value)) return null
  return { value, unit }
}

export function GroceryListDetailScreen() {
  const { listId } = useParams()
  const navigate = useNavigate()
  const { groceryService } = useServices()
  const detail = useGroceryList(listId)
  const formatQty = useFormatQuantity()
  const [editingId, setEditingId] = useState<string | undefined>(undefined)
  const [grouped, setGrouped] = useState(true)
  const [hideChecked, setHideChecked] = useState(false)

  const addForm = useForm<ManualItemForm>({
    initialValues: { label: '', quantityValue: '', quantityUnit: 'piece', shoppingSection: '' },
    validate: {
      label: (value) => (value.trim().length === 0 ? 'Label is required' : null),
    },
  })

  const editForm = useForm<EditItemForm>({
    initialValues: { label: '', quantityValue: '', quantityUnit: 'g', shoppingSection: '' },
  })

  if (detail === undefined) {
    return (
      <Stack gap="md" align="center" py="xl">
        <Loader size="sm" />
        <Text c="dimmed">Loading list…</Text>
      </Stack>
    )
  }

  if (detail === null) {
    return (
      <Stack gap="md">
        <ScreenHeader title="List not found" fallbackTo="/lists" />
        <Text c="dimmed">This grocery list could not be found.</Text>
      </Stack>
    )
  }

  const { list, items } = detail
  const closed = list.status === 'closed'
  const view = groceryListView(items, { hideChecked, grouped })

  const handleToggle = async (item: GroceryItem) => {
    const result = await groceryService.toggleChecked(item.id)
    if (!result.ok) {
      notifications.show({ message: `Could not update item (${result.error})`, color: 'red' })
    }
  }

  const handleAdd = addForm.onSubmit(async (values) => {
    const result = await groceryService.addManualItem(
      list.id,
      values.label,
      quantityFromForm(values.quantityValue, values.quantityUnit),
      values.shoppingSection || undefined,
    )
    if (!result.ok) {
      notifications.show({ message: `Could not add item (${result.error})`, color: 'red' })
      return
    }
    addForm.reset()
  })

  const startEdit = (item: GroceryItem) => {
    setEditingId(item.id)
    editForm.setValues({
      label: item.label,
      quantityValue: item.quantity?.value ?? '',
      quantityUnit: item.quantity?.unit ?? 'g',
      shoppingSection: item.shoppingSection ?? '',
    })
  }

  const saveEdit = editForm.onSubmit(async (values) => {
    if (!editingId) return
    const result = await groceryService.updateItem(editingId, {
      label: values.label,
      quantity: quantityFromForm(values.quantityValue, values.quantityUnit),
      shoppingSection: values.shoppingSection || null,
    })
    if (!result.ok) {
      notifications.show({ message: `Could not save (${result.error})`, color: 'red' })
      return
    }
    setEditingId(undefined)
  })

  const handleDeleteItem = (item: GroceryItem) => {
    modals.openConfirmModal({
      title: 'Delete item',
      children: <Text>Remove “{item.label}” from this list?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const result = await groceryService.deleteItem(item.id)
        if (!result.ok) {
          notifications.show({ message: `Could not delete (${result.error})`, color: 'red' })
        }
      },
    })
  }

  const handleCloseOrReopen = () => {
    if (closed) {
      void groceryService.reopenList(list.id).then((result) => {
        if (!result.ok) {
          notifications.show({ message: `Could not reopen (${result.error})`, color: 'red' })
        }
      })
      return
    }
    modals.openConfirmModal({
      title: 'Close list',
      children: (
        <Text>
          Closed lists cannot be edited or updated from a plan. You can reopen them later.
        </Text>
      ),
      labels: { confirm: 'Close list', cancel: 'Cancel' },
      onConfirm: () => {
        void groceryService.closeList(list.id).then((result) => {
          if (!result.ok) {
            notifications.show({ message: `Could not close (${result.error})`, color: 'red' })
          }
        })
      },
    })
  }

  const handleDeleteList = () => {
    modals.openConfirmModal({
      title: 'Delete list',
      children: <Text>Delete “{list.title}” and all of its items? This cannot be undone.</Text>,
      labels: { confirm: 'Delete list', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const result = await groceryService.deleteList(list.id)
        if (!result.ok) {
          notifications.show({ message: `Could not delete (${result.error})`, color: 'red' })
          return
        }
        navigate('/lists')
      },
    })
  }

  const renderItem = (item: GroceryItem) => (
    <Group
      key={item.id}
      wrap="nowrap"
      align={editingId === item.id ? 'flex-start' : 'center'}
      gap="sm"
      style={{ minHeight: 44 }}
    >
      <Checkbox
        checked={item.checked}
        disabled={closed}
        onChange={() => void handleToggle(item)}
        aria-label={`Check ${item.label}`}
        style={{ flexShrink: 0 }}
      />
      {editingId === item.id ? (
        <form onSubmit={saveEdit} style={{ flex: 1 }}>
          <Stack gap="xs">
            <TextInput label="Label" required {...editForm.getInputProps('label')} />
            <QuantityFields
              value={editForm.values.quantityValue}
              unit={editForm.values.quantityUnit}
              onValueChange={(value) => editForm.setFieldValue('quantityValue', value)}
              onUnitChange={(unit) => editForm.setFieldValue('quantityUnit', unit)}
            />
            <ShoppingSectionSelect
              value={editForm.values.shoppingSection || undefined}
              onChange={(section) => editForm.setFieldValue('shoppingSection', section ?? '')}
            />
            <Group>
              <Button type="submit" size="xs">
                Save
              </Button>
              <Button
                type="button"
                size="xs"
                variant="default"
                onClick={() => setEditingId(undefined)}
              >
                Cancel
              </Button>
            </Group>
          </Stack>
        </form>
      ) : (
        <>
          <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
            <Text
              td={item.checked ? 'line-through' : undefined}
              c={item.checked ? 'dimmed' : undefined}
            >
              {item.label}
            </Text>
            <Text size="sm" c="dimmed">
              {formatQty(item.quantity)}
              {item.origin === 'manual' ? ' · manual' : ''}
            </Text>
          </Stack>
          {!closed && (
            <Group gap={4} wrap="nowrap">
              <ActionIcon
                variant="subtle"
                aria-label={`Edit ${item.label}`}
                onClick={() => startEdit(item)}
              >
                <IconPencil size={16} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label={`Delete ${item.label}`}
                onClick={() => handleDeleteItem(item)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          )}
        </>
      )}
    </Group>
  )

  const listBody =
    items.length === 0 ? (
      <Text c="dimmed">No items yet.</Text>
    ) : view.mode === 'flat' ? (
      view.items.length === 0 ? (
        <Text c="dimmed">All items are checked.</Text>
      ) : (
        view.items.map(renderItem)
      )
    ) : view.groups.length === 0 ? (
      <Text c="dimmed">All items are checked.</Text>
    ) : (
      view.groups.map((group) => (
        <Stack key={group.key} gap="sm">
          <Title order={4}>{shoppingSectionLabel(group.key)}</Title>
          {group.items.map(renderItem)}
        </Stack>
      ))
    )

  return (
    <Stack gap="md">
      <ScreenHeader
        title={list.title}
        fallbackTo="/lists"
        actions={
          <Badge w="fit-content" color={closed ? 'gray' : 'green'} variant="light">
            {list.status}
          </Badge>
        }
      />

      <Group>
        <Button variant="light" onClick={handleCloseOrReopen}>
          {closed ? 'Reopen' : 'Close'}
        </Button>
        <Button variant="subtle" color="red" onClick={handleDeleteList}>
          Delete list
        </Button>
      </Group>

      <SegmentedControl
        value={grouped ? 'grouped' : 'flat'}
        onChange={(value) => setGrouped(value === 'grouped')}
        data={[
          { value: 'grouped', label: 'Grouped' },
          { value: 'flat', label: 'Flat' },
        ]}
      />
      <Switch
        label="Hide checked items"
        checked={hideChecked}
        onChange={(event) => setHideChecked(event.currentTarget.checked)}
      />

      <Stack gap="sm">{listBody}</Stack>

      {!closed && (
        <form onSubmit={handleAdd}>
          <Stack gap="sm">
            <Text fw={600}>Add item</Text>
            <TextInput label="Label" required {...addForm.getInputProps('label')} />
            <QuantityFields
              value={addForm.values.quantityValue}
              unit={addForm.values.quantityUnit}
              onValueChange={(value) => addForm.setFieldValue('quantityValue', value)}
              onUnitChange={(unit) => addForm.setFieldValue('quantityUnit', unit)}
            />
            <ShoppingSectionSelect
              value={addForm.values.shoppingSection || undefined}
              onChange={(section) => addForm.setFieldValue('shoppingSection', section ?? '')}
            />
            <Button type="submit">Add to list</Button>
          </Stack>
        </form>
      )}
    </Stack>
  )
}
