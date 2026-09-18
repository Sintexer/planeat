import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Checkbox,
  Collapse,
  Group,
  Stack,
  Text,
  TextInput,
  Loader,
  Paper,
  SegmentedControl,
  Switch,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { IconChevronDown, IconChevronUp, IconPencil, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useServices } from '../../app/servicesContext'
import type { GroceryItem, GroceryItemSource } from '../../domain/groceries/GroceryItem'
import { groceryListView, clusterGroceryItems } from '../../domain/groceries/shoppingSections'
import type { Quantity } from '../../domain/shared/Quantity'
import type { PlanGraph } from '../../domain/plans/PlanGraph'
import { mealTypeLabel, shoppingSectionLabel } from '../localization/labels'
import type { Translate } from '../localization/t'
import { QuantityFields } from '../components/QuantityFields'
import { ScreenHeader } from '../components/ScreenHeader'
import { ShoppingSectionSelect } from '../components/ShoppingSectionSelect'
import { useGroceryList } from '../hooks/useGroceryList'
import { usePlan } from '../hooks/usePlan'
import { useFormatQuantity } from '../localization/useFormatQuantity'
import { useLocalization } from '../localization/LocalizationContext'

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

function sourceMealType(t: Translate, mealType: string): string {
  return mealTypeLabel(t, mealType).toLowerCase()
}

function weekdayLong(date: string, locale: string): string {
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return date
  return new Date(year, month - 1, day).toLocaleDateString(locale, { weekday: 'long' })
}

function sourceHeading(source: GroceryItemSource, locale: string, t: Translate): string {
  const meals = source.meals
    .map((meal) => `${weekdayLong(meal.date, locale)} ${sourceMealType(t, meal.mealType)}`)
    .join(', ')
  if (!meals) return source.dishName
  return `${meals} — ${source.dishName}`
}

function quantityFromForm(value: number | '', unit: string): Quantity | null {
  if (value === '' || !Number.isFinite(value)) return null
  return { value, unit }
}

function GrocerySourceRow({
  source,
  planId,
  liveSlotIds,
  planGraph,
  locale,
  formatQty,
  t,
}: {
  source: GroceryItemSource
  planId?: string
  liveSlotIds: Set<string>
  planGraph: PlanGraph | undefined
  locale: string
  formatQty: (quantity: Quantity | null) => string
  t: Translate
}) {
  const heading = sourceHeading(source, locale, t)
  const liveMeal = source.meals.find((meal) => liveSlotIds.has(meal.slotId))
  const missingMeal =
    Boolean(planId && planGraph) && source.meals.some((meal) => !liveSlotIds.has(meal.slotId))
  const canLink = Boolean(planId && liveMeal)

  return (
    <Stack gap={0}>
      <Group justify="space-between" wrap="nowrap" gap="sm">
        {canLink && liveMeal ? (
          <Anchor
            component={Link}
            to={`/plan/${planId}?date=${liveMeal.date}`}
            size="sm"
            style={{ minWidth: 0 }}
          >
            {heading}
          </Anchor>
        ) : (
          <Text size="sm" style={{ minWidth: 0 }}>
            {heading}
          </Text>
        )}
        <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>
          {formatQty(source.quantity)}
        </Text>
      </Group>
      {missingMeal ? (
        <Text size="xs" c="dimmed">
          This meal is no longer on the plan.
        </Text>
      ) : null}
    </Stack>
  )
}

export function GroceryListDetailScreen() {
  const { listId } = useParams()
  const navigate = useNavigate()
  const { groceryService } = useServices()
  const detail = useGroceryList(listId)
  const sourcePlan = usePlan(detail?.list.sourcePlanId)
  const formatQty = useFormatQuantity()
  const { t, bcp47 } = useLocalization()
  const [editingId, setEditingId] = useState<string | undefined>(undefined)
  const [expandedSourceId, setExpandedSourceId] = useState<string | undefined>(undefined)
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
        <Text c="dimmed">{t('grocery.loading')}</Text>
      </Stack>
    )
  }

  if (detail === null) {
    return (
      <Stack gap="md">
        <ScreenHeader title={t('grocery.listNotFoundTitle')} fallbackTo="/lists" />
        <Text c="dimmed">{t('grocery.notFound')}</Text>
      </Stack>
    )
  }

  const { list, items } = detail
  const closed = list.status === 'closed'
  const view = groceryListView(items, { hideChecked, grouped })
  const liveSlotIds = new Set(sourcePlan?.slots.map((slot) => slot.id) ?? [])

  const handleToggle = async (item: GroceryItem) => {
    const result = await groceryService.toggleChecked(item.id)
    if (!result.ok) {
      notifications.show({
        message: t('grocery.error.updateItem', { error: result.error }),
        color: 'red',
      })
    }
  }

  const handleToggleCluster = async (cluster: GroceryItem[], checked: boolean) => {
    for (const item of cluster) {
      if (item.checked === checked) continue
      const result = await groceryService.toggleChecked(item.id)
      if (!result.ok) {
        notifications.show({
          message: t('grocery.error.updateItem', { error: result.error }),
          color: 'red',
        })
        return
      }
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
      notifications.show({
        message: t('grocery.error.addItem', { error: result.error }),
        color: 'red',
      })
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
      notifications.show({
        message: t('grocery.saveFailed', { error: result.error }),
        color: 'red',
      })
      return
    }
    setEditingId(undefined)
  })

  const handleDeleteItem = (item: GroceryItem) => {
    modals.openConfirmModal({
      title: t('grocery.deleteItemTitle'),
      children: <Text>{t('grocery.deleteItemBody', { name: item.label })}</Text>,
      labels: { confirm: t('action.delete'), cancel: t('action.cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const result = await groceryService.deleteItem(item.id)
        if (!result.ok) {
          notifications.show({
            message: t('grocery.error.delete', { error: result.error }),
            color: 'red',
          })
        }
      },
    })
  }

  const handleCloseOrReopen = () => {
    if (closed) {
      void groceryService.reopenList(list.id).then((result) => {
        if (!result.ok) {
          notifications.show({
            message: t('grocery.error.reopen', { error: result.error }),
            color: 'red',
          })
        }
      })
      return
    }
    modals.openConfirmModal({
      title: t('grocery.closeTitle'),
      children: <Text>{t('grocery.closeBody')}</Text>,
      labels: { confirm: t('grocery.closeConfirm'), cancel: t('action.cancel') },
      onConfirm: () => {
        void groceryService.closeList(list.id).then((result) => {
          if (!result.ok) {
            notifications.show({
              message: t('grocery.error.close', { error: result.error }),
              color: 'red',
            })
          }
        })
      },
    })
  }

  const handleDeleteList = () => {
    modals.openConfirmModal({
      title: t('grocery.deleteListTitle'),
      children: <Text>{t('grocery.deleteListBody', { name: list.title })}</Text>,
      labels: { confirm: t('grocery.deleteListConfirm'), cancel: t('action.cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const result = await groceryService.deleteList(list.id)
        if (!result.ok) {
          notifications.show({
            message: t('grocery.error.delete', { error: result.error }),
            color: 'red',
          })
          return
        }
        navigate('/lists')
      },
    })
  }

  const renderItem = (item: GroceryItem, hideLabel = false) => (
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
        aria-label={t('grocery.checkItem', { name: item.label })}
        style={{ flexShrink: 0 }}
      />
      {editingId === item.id ? (
        <form onSubmit={saveEdit} style={{ flex: 1 }}>
          <Stack gap="xs">
            <TextInput label={t('common.label')} required {...editForm.getInputProps('label')} />
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
            {!hideLabel ? (
              <Text
                td={item.checked ? 'line-through' : undefined}
                c={item.checked ? 'dimmed' : undefined}
              >
                {item.label}
              </Text>
            ) : null}
            <Text
              size={hideLabel ? 'md' : 'sm'}
              td={hideLabel && item.checked ? 'line-through' : undefined}
              c={item.checked || !hideLabel ? 'dimmed' : undefined}
            >
              {formatQty(item.quantity)}
              {item.origin === 'manual' ? ' · manual' : ''}
            </Text>
            {item.origin === 'generated' && !item.sources?.length ? (
              <Text size="xs" c="dimmed">
                Update this list from the plan to see which meals need this item.
              </Text>
            ) : null}
            {item.origin === 'generated' && item.sources && item.sources.length > 0 ? (
              <>
                <UnstyledButton
                  onClick={() =>
                    setExpandedSourceId(expandedSourceId === item.id ? undefined : item.id)
                  }
                  aria-expanded={expandedSourceId === item.id}
                  aria-label={`Used by ${item.label}`}
                >
                  <Group gap={4}>
                    <Text size="xs" c="dimmed">
                      Used by
                    </Text>
                    {expandedSourceId === item.id ? (
                      <IconChevronUp size={14} />
                    ) : (
                      <IconChevronDown size={14} />
                    )}
                  </Group>
                </UnstyledButton>
                <Collapse expanded={expandedSourceId === item.id}>
                  <Stack gap={4} mt={4}>
                    {item.sources.map((source, index) => (
                      <GrocerySourceRow
                        key={`${item.id}-source-${index}`}
                        source={source}
                        planId={list.sourcePlanId}
                        liveSlotIds={liveSlotIds}
                        planGraph={sourcePlan}
                        locale={bcp47}
                        formatQty={formatQty}
                        t={t}
                      />
                    ))}
                  </Stack>
                </Collapse>
              </>
            ) : null}
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

  const renderCluster = (cluster: GroceryItem[]) => {
    if (cluster.length === 1) return renderItem(cluster[0]!)
    const label = cluster[0]!.label
    const allChecked = cluster.every((item) => item.checked)
    const someChecked = cluster.some((item) => item.checked)
    return (
      <Paper key={cluster.map((item) => item.id).join('-')} withBorder p={12} radius="md">
        <Stack gap="xs">
          <Group wrap="nowrap" gap="sm" style={{ minHeight: 44 }}>
            <Checkbox
              checked={allChecked}
              indeterminate={someChecked && !allChecked}
              disabled={closed}
              onChange={() => void handleToggleCluster(cluster, !allChecked)}
              aria-label={`Check all ${label}`}
              style={{ flexShrink: 0 }}
            />
            <Text
              fw={600}
              td={allChecked ? 'line-through' : undefined}
              c={allChecked ? 'dimmed' : undefined}
            >
              {label}
            </Text>
          </Group>
          <Stack gap="xs" pl={32}>
            {cluster.map((item) => renderItem(item, true))}
          </Stack>
        </Stack>
      </Paper>
    )
  }

  const listBody =
    items.length === 0 ? (
      <Text c="dimmed">{t('grocery.noItems')}</Text>
    ) : view.mode === 'flat' ? (
      view.items.length === 0 ? (
        <Text c="dimmed">{t('grocery.allChecked')}</Text>
      ) : (
        clusterGroceryItems(view.items).map(renderCluster)
      )
    ) : view.groups.length === 0 ? (
      <Text c="dimmed">{t('grocery.allChecked')}</Text>
    ) : (
      view.groups.map((group) => (
        <Stack key={group.key} gap="sm">
          <Title order={4}>{shoppingSectionLabel(t, group.key)}</Title>
          {clusterGroceryItems(group.items).map(renderCluster)}
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
            {list.status === 'closed' ? t('lists.status.closed') : t('lists.status.open')}
          </Badge>
        }
      />

      <Group>
        <Button variant="light" onClick={handleCloseOrReopen}>
          {closed ? t('grocery.reopen') : t('grocery.close')}
        </Button>
        <Button variant="subtle" color="red" onClick={handleDeleteList}>
          {t('grocery.deleteListConfirm')}
        </Button>
      </Group>

      <SegmentedControl
        value={grouped ? 'grouped' : 'flat'}
        onChange={(value) => setGrouped(value === 'grouped')}
        data={[
          { value: 'grouped', label: t('grocery.grouped') },
          { value: 'flat', label: t('grocery.flat') },
        ]}
      />
      <Switch
        label={t('grocery.hideChecked')}
        checked={hideChecked}
        onChange={(event) => setHideChecked(event.currentTarget.checked)}
      />

      <Stack gap="sm">{listBody}</Stack>

      {!closed && (
        <form onSubmit={handleAdd}>
          <Stack gap="sm">
            <Text fw={600}>{t('grocery.addItem')}</Text>
            <TextInput label={t('common.label')} required {...addForm.getInputProps('label')} />
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
            <Button type="submit">{t('grocery.addToList')}</Button>
          </Stack>
        </form>
      )}
    </Stack>
  )
}
