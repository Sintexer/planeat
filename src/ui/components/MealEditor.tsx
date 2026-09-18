import {
  Alert,
  Button,
  Group,
  Menu,
  Modal,
  Paper,
  Skeleton,
  Stack,
  Text,
  TextInput,
  ActionIcon,
} from '@mantine/core'
import {
  BookmarkSimple,
  Calendar,
  DotsThreeVertical,
  ForkKnife,
  PencilSimple,
  Plus,
  Star,
  Trash,
  Warning,
} from '@phosphor-icons/react'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { useMemo, useState } from 'react'
import { useServices } from '../../app/servicesContext'
import type { FavoriteComponent } from '../../domain/favorites/MealFavorite'
import type { CookingEventId } from '../../domain/plans/CookingEvent'
import type { MealComponentId } from '../../domain/plans/MealComponent'
import type { MealSlot } from '../../domain/plans/MealSlot'
import type { PlanGraph } from '../../domain/plans/PlanGraph'
import type { Quantity } from '../../domain/shared/Quantity'
import { hasUnallocatedRemainder } from '../../domain/plans/CookingEventAllocation'
import { useMealFavorites } from '../hooks/useMealFavorites'
import { componentLabel, type SlotComponentDisplay } from '../plans/slotDisplay'
import { AddComponentFlow } from './AddComponentFlow'
import { QuantityFields } from './QuantityFields'
import { useFormatQuantity } from '../localization/useFormatQuantity'
import { useLocalization } from '../localization/LocalizationContext'
import { mealTypeLabel } from '../localization/labels'
import { planErrorMessage } from '../localization/errors'
import type { Translate } from '../localization/t'

interface MealEditorProps {
  opened: boolean
  onClose: () => void
  slot: MealSlot
  graph: PlanGraph
  components: SlotComponentDisplay[]
}

function formatDependentLine(t: Translate, date: string, mealType: string): string {
  return `${date} ${mealTypeLabel(t, mealType)}`
}

function openOverAllocationChoices(args: {
  t: Translate
  title?: string
  onIncrease: () => void
  onReduce: () => void
  onCreateAnother?: () => void
}) {
  const { t } = args
  modals.open({
    title: args.title ?? t('meal.overAllocTitle'),
    children: (
      <Stack gap="sm">
        <Alert color="warning" icon={<Warning size={16} />}>
          {t('meal.overAllocBody')}
        </Alert>
        <Button
          onClick={() => {
            modals.closeAll()
            args.onIncrease()
          }}
        >
          {t('meal.increaseOutput')}
        </Button>
        <Button
          variant="light"
          onClick={() => {
            modals.closeAll()
            args.onReduce()
          }}
        >
          {t('meal.reduceAlloc')}
        </Button>
        {args.onCreateAnother && (
          <Button
            variant="light"
            onClick={() => {
              modals.closeAll()
              args.onCreateAnother?.()
            }}
          >
            {t('meal.createAnother')}
          </Button>
        )}
        <Button variant="default" onClick={() => modals.closeAll()}>
          {t('action.cancel')}
        </Button>
      </Stack>
    ),
  })
}

export function MealEditor({ opened, onClose, slot, graph, components }: MealEditorProps) {
  const { planService, mealFavoriteService } = useServices()
  const favorites = useMealFavorites()
  const formatQty = useFormatQuantity()
  const { t } = useLocalization()
  const [addOpen, setAddOpen] = useState(false)
  const [insertFavoriteOpen, setInsertFavoriteOpen] = useState(false)
  const [editComponentId, setEditComponentId] = useState<MealComponentId | undefined>()
  const [editEventId, setEditEventId] = useState<CookingEventId | undefined>()
  const [allocValue, setAllocValue] = useState<number | ''>('')
  const [allocUnit, setAllocUnit] = useState('piece')
  const [outputValue, setOutputValue] = useState<number | ''>('')
  const [outputUnit, setOutputUnit] = useState('piece')
  const [prepDate, setPrepDate] = useState(slot.date)
  const [savingAllocation, setSavingAllocation] = useState(false)
  const [savingPrep, setSavingPrep] = useState(false)

  const toFavoriteComponents = (): FavoriteComponent[] => {
    const result: FavoriteComponent[] = []
    for (const item of components) {
      if (item.cookingEvent) {
        result.push({
          type: 'recipe',
          recipeId: item.cookingEvent.recipeId,
          allocatedQuantity: item.component.allocatedQuantity,
          role: item.component.role,
        })
      } else if (item.component.source.type === 'simple-food') {
        result.push({
          type: 'simple-food',
          simpleFoodId: item.component.source.simpleFoodId,
          allocatedQuantity: item.component.allocatedQuantity,
          role: item.component.role,
        })
      }
    }
    return result
  }

  const saveAsFavorite = () => {
    const favoriteComponents = toFavoriteComponents()
    if (favoriteComponents.length === 0) {
      notifications.show({ message: t('meal.favoriteNeedComponents'), color: 'warning' })
      return
    }
    modals.open({
      title: t('meal.saveFavorite'),
      children: (
        <FavoriteNameForm
          onSave={async (name) => {
            const result = await mealFavoriteService.create(name, favoriteComponents)
            if (!result.ok) {
              const message =
                result.error === 'duplicate-name'
                  ? t('meal.duplicateName')
                  : result.error === 'empty-name'
                    ? t('meal.emptyName')
                    : t('meal.saveFavoriteFailed')
              notifications.show({ message, color: 'error' })
              return
            }
            modals.closeAll()
            notifications.show({ message: t('meal.favoriteSaved'), color: 'success' })
          }}
        />
      ),
    })
  }

  const insertFavorite = async (favoriteId: string) => {
    const favorite = favorites?.find((f) => f.id === favoriteId)
    if (!favorite) return
    const result = await planService.insertFavoriteComponents(slot.id, favorite.components)
    if (!result.ok) {
      notifications.show({
        message:
          result.error === 'favorite-missing-ref'
            ? t('meal.missingRef', { label: result.missingLabel ?? t('common.unknownItem') })
            : planErrorMessage(t, result.error),
        color: 'error',
      })
      return
    }
    setInsertFavoriteOpen(false)
    notifications.show({ message: t('meal.inserted', { name: favorite.name }), color: 'success' })
  }

  const deleteFavorite = async (favoriteId: string, name: string) => {
    modals.openConfirmModal({
      title: t('meal.deleteFavorite'),
      children: (
        <Text size="sm">
          {t('meal.deleteFavoriteBody', { name })} {t('meal.cannotUndo')}
        </Text>
      ),
      labels: { confirm: t('action.delete'), cancel: t('action.cancel') },
      confirmProps: { color: 'error' },
      onConfirm: () => {
        void mealFavoriteService.delete(favoriteId).then((result) => {
          if (!result.ok) {
            notifications.show({ message: t('meal.deleteFavoriteFailed'), color: 'error' })
          }
        })
      },
    })
  }

  const unusedWarnings = useMemo(() => {
    const seen = new Set<string>()
    const lines: string[] = []
    for (const item of components) {
      if (!item.cookingEvent) continue
      const id = item.cookingEvent.id
      if (seen.has(id)) continue
      seen.add(id)
      const remaining = planService.remainingForCookingEvent(graph, id)
      if (hasUnallocatedRemainder(remaining) && remaining) {
        lines.push(
          t('meal.unallocatedLine', {
            name: item.cookingEvent.recipeSnapshot.name,
            quantity: formatQty(remaining),
          }),
        )
      }
    }
    return lines
  }, [components, graph, planService, formatQty, t])

  const openEditAllocation = (item: SlotComponentDisplay) => {
    setEditEventId(undefined)
    setEditComponentId(item.component.id)
    setAllocValue(item.component.allocatedQuantity.value)
    setAllocUnit(item.component.allocatedQuantity.unit)
  }

  const openEditPrep = (item: SlotComponentDisplay) => {
    if (!item.cookingEvent) return
    setEditComponentId(undefined)
    setEditEventId(item.cookingEvent.id)
    setOutputValue(item.cookingEvent.outputQuantity.value)
    setOutputUnit(item.cookingEvent.outputQuantity.unit)
    setPrepDate(item.cookingEvent.scheduledDate)
  }

  const saveAllocation = async () => {
    if (!editComponentId || typeof allocValue !== 'number') return
    const allocatedQuantity = { value: allocValue, unit: allocUnit }
    setSavingAllocation(true)
    const result = await planService.updateComponentAllocation(editComponentId, allocatedQuantity)
    setSavingAllocation(false)
    if (!result.ok) {
      if (result.error === 'over-allocated') {
        const item = components.find((c) => c.component.id === editComponentId)
        const event = item?.cookingEvent
        openOverAllocationChoices({
          t,
          onIncrease: () => {
            if (!event) return
            void (async () => {
              const bump = await planService.updateCookingEvent(event.id, {
                outputQuantity: {
                  value: Math.max(event.outputQuantity.value, allocatedQuantity.value),
                  unit: event.outputQuantity.unit,
                },
              })
              if (!bump.ok) {
                notifications.show({ message: planErrorMessage(t, bump.error), color: 'error' })
                return
              }
              // Raise output enough for all other allocations + this one
              const others = graph.components.filter(
                (c) =>
                  c.id !== editComponentId &&
                  c.source.type === 'cooking-event' &&
                  c.source.cookingEventId === event.id,
              )
              let needed = allocatedQuantity.value
              for (const c of others) {
                if (c.allocatedQuantity.unit === allocatedQuantity.unit) {
                  needed += c.allocatedQuantity.value
                }
              }
              await planService.updateCookingEvent(event.id, {
                outputQuantity: { value: needed, unit: event.outputQuantity.unit },
              })
              const alloc = await planService.updateComponentAllocation(
                editComponentId,
                allocatedQuantity,
              )
              if (!alloc.ok) {
                notifications.show({ message: planErrorMessage(t, alloc.error), color: 'error' })
                return
              }
              setEditComponentId(undefined)
            })()
          },
          onReduce: () => {
            if (!event || !item) return
            const remaining = planService.remainingForCookingEvent(graph, event.id)
            const current = item.component.allocatedQuantity
            if (remaining && current.unit === remaining.unit) {
              setAllocValue(remaining.value + current.value)
              setAllocUnit(remaining.unit)
            }
          },
          onCreateAnother: event
            ? () => {
                void (async () => {
                  const created = await planService.addNewCookingEventComponent(
                    slot.id,
                    event.recipeId,
                    {
                      allocatedQuantity,
                      outputQuantity: allocatedQuantity,
                      scheduledDate: slot.date,
                      role: item?.component.role,
                    },
                  )
                  if (!created.ok) {
                    notifications.show({
                      message: planErrorMessage(t, created.error),
                      color: 'error',
                    })
                    return
                  }
                  await planService.removeComponent(editComponentId)
                  setEditComponentId(undefined)
                })()
              }
            : undefined,
        })
        return
      }
      notifications.show({ message: planErrorMessage(t, result.error), color: 'error' })
      return
    }
    setEditComponentId(undefined)
  }

  const savePrep = async () => {
    if (!editEventId || typeof outputValue !== 'number') return
    setSavingPrep(true)
    const result = await planService.updateCookingEvent(editEventId, {
      outputQuantity: { value: outputValue, unit: outputUnit },
      scheduledDate: prepDate,
    })
    setSavingPrep(false)
    if (!result.ok) {
      notifications.show({ message: planErrorMessage(t, result.error), color: 'error' })
      return
    }
    setEditEventId(undefined)
  }

  const handleOverAllocatedFromAdd = (args: {
    kind: 'link' | 'cook-new'
    cookingEventId?: string
    recipeId?: string
    allocatedQuantity: Quantity
    outputQuantity?: Quantity
    scheduledDate?: string
  }) => {
    openOverAllocationChoices({
      t,
      onIncrease: () => {
        void (async () => {
          if (args.kind === 'cook-new' && args.recipeId) {
            const result = await planService.addNewCookingEventComponent(slot.id, args.recipeId, {
              allocatedQuantity: args.allocatedQuantity,
              outputQuantity: args.allocatedQuantity,
              scheduledDate: args.scheduledDate ?? slot.date,
            })
            if (!result.ok) {
              notifications.show({ message: planErrorMessage(t, result.error), color: 'error' })
              return
            }
            setAddOpen(false)
            return
          }
          if (args.kind === 'link' && args.cookingEventId) {
            const event = graph.cookingEvents.find((e) => e.id === args.cookingEventId)
            if (!event) return
            const others = graph.components.filter(
              (c) => c.source.type === 'cooking-event' && c.source.cookingEventId === event.id,
            )
            let needed = args.allocatedQuantity.value
            for (const c of others) {
              if (c.allocatedQuantity.unit === args.allocatedQuantity.unit) {
                needed += c.allocatedQuantity.value
              }
            }
            const bump = await planService.updateCookingEvent(event.id, {
              outputQuantity: { value: needed, unit: event.outputQuantity.unit },
            })
            if (!bump.ok) {
              notifications.show({ message: planErrorMessage(t, bump.error), color: 'error' })
              return
            }
            const linked = await planService.linkExistingCookingEvent(slot.id, event.id, {
              allocatedQuantity: args.allocatedQuantity,
            })
            if (!linked.ok) {
              notifications.show({ message: planErrorMessage(t, linked.error), color: 'error' })
              return
            }
            setAddOpen(false)
          }
        })()
      },
      onReduce: () => {
        // Leave add flow open so the user can lower the amount.
      },
      onCreateAnother:
        args.kind === 'link' && args.cookingEventId
          ? () => {
              const event = graph.cookingEvents.find((e) => e.id === args.cookingEventId)
              if (!event) return
              void (async () => {
                const created = await planService.addNewCookingEventComponent(
                  slot.id,
                  event.recipeId,
                  {
                    allocatedQuantity: args.allocatedQuantity,
                    outputQuantity: args.allocatedQuantity,
                    scheduledDate: slot.date,
                  },
                )
                if (!created.ok) {
                  notifications.show({
                    message: planErrorMessage(t, created.error),
                    color: 'error',
                  })
                  return
                }
                setAddOpen(false)
              })()
            }
          : undefined,
    })
  }

  const confirmRemoveComponent = (item: SlotComponentDisplay) => {
    void (async () => {
      if (item.component.source.type !== 'cooking-event') {
        modals.openConfirmModal({
          title: t('meal.removeComponent'),
          children: (
            <Text size="sm">{t('meal.removeNamedBody', { name: componentLabel(item) })}</Text>
          ),
          labels: { confirm: t('action.remove'), cancel: t('action.cancel') },
          confirmProps: { color: 'error' },
          onConfirm: () => {
            void planService.removeComponent(item.component.id).then((result) => {
              if (!result.ok) {
                notifications.show({ message: planErrorMessage(t, result.error), color: 'error' })
              }
            })
          },
        })
        return
      }

      const eventId = item.component.source.cookingEventId
      const depsResult = await planService.listCookingEventDependents(eventId)
      if (!depsResult.ok) {
        notifications.show({ message: planErrorMessage(t, depsResult.error), color: 'error' })
        return
      }
      const others = depsResult.dependents.filter((d) => d.componentId !== item.component.id)
      if (others.length === 0) {
        modals.openConfirmModal({
          title: t('meal.removeComponent'),
          children: (
            <Text size="sm">{t('meal.removeNamedBody', { name: componentLabel(item) })}</Text>
          ),
          labels: { confirm: t('action.remove'), cancel: t('action.cancel') },
          confirmProps: { color: 'error' },
          onConfirm: () => {
            void planService.removeComponent(item.component.id).then((result) => {
              if (!result.ok) {
                notifications.show({ message: planErrorMessage(t, result.error), color: 'error' })
              }
            })
          },
        })
        return
      }

      modals.open({
        title: t('meal.sharedPrep'),
        children: (
          <Stack gap="sm">
            <Text size="sm">{t('meal.alsoSupplies')}</Text>
            <Stack gap={2}>
              {depsResult.dependents.map((d) => (
                <Text key={d.componentId} size="sm">
                  • {formatDependentLine(t, d.date, d.mealType)}
                </Text>
              ))}
            </Stack>
            <Button
              onClick={() => {
                modals.closeAll()
                void planService.removeComponent(item.component.id).then((result) => {
                  if (!result.ok) {
                    notifications.show({
                      message: planErrorMessage(t, result.error),
                      color: 'error',
                    })
                  }
                })
              }}
            >
              {t('meal.removeThisOnly')}
            </Button>
            <Button
              color="error"
              variant="light"
              onClick={() => {
                modals.closeAll()
                void planService.removeCookingEventEverywhere(eventId).then((result) => {
                  if (!result.ok) {
                    notifications.show({
                      message: planErrorMessage(t, result.error),
                      color: 'error',
                    })
                  }
                })
              }}
            >
              {t('meal.removeAllAffected')}
            </Button>
            <Button variant="default" onClick={() => modals.closeAll()}>
              {t('action.cancel')}
            </Button>
          </Stack>
        ),
      })
    })()
  }

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title={t('meal.slotTitle', { meal: mealTypeLabel(t, slot.mealType), date: slot.date })}
        centered
        size="md"
      >
        <Stack gap="sm">
          {unusedWarnings.length > 0 && (
            <Alert color="warning" icon={<Warning size={16} />} title={t('meal.unallocatedPrep')}>
              {unusedWarnings.map((line) => (
                <Text key={line} size="sm">
                  {line}
                </Text>
              ))}
            </Alert>
          )}

          {components.length === 0 && (
            <Stack gap={6} align="center" py="md">
              <ForkKnife size={28} style={{ color: 'var(--mantine-color-dimmed)' }} />
              <Text size="sm" c="dimmed" ta="center">
                {t('meal.noComponents')}
              </Text>
            </Stack>
          )}

          {components.map((item) => (
            <Paper key={item.component.id} withBorder radius="md" p="xs">
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
                  <Text size="sm" fw={600}>
                    {componentLabel(item)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatQty(item.component.allocatedQuantity)}
                    {item.cookingEvent
                      ? t('meal.prepLine', {
                          date: item.cookingEvent.scheduledDate,
                          quantity: formatQty(item.cookingEvent.outputQuantity),
                        })
                      : ''}
                  </Text>
                </Stack>
                <Group gap={4} wrap="nowrap">
                  <ActionIcon
                    variant="subtle"
                    aria-label={t('meal.editAllocation')}
                    onClick={() => openEditAllocation(item)}
                  >
                    <PencilSimple size={16} />
                  </ActionIcon>
                  {item.cookingEvent && (
                    <ActionIcon
                      variant="subtle"
                      aria-label={t('meal.editPrep')}
                      onClick={() => openEditPrep(item)}
                    >
                      <Calendar size={16} />
                    </ActionIcon>
                  )}
                  <ActionIcon
                    variant="subtle"
                    color="error"
                    aria-label={t('meal.removeComponentAria')}
                    onClick={() => confirmRemoveComponent(item)}
                  >
                    <Trash size={16} />
                  </ActionIcon>
                </Group>
              </Group>
            </Paper>
          ))}

          {editComponentId && (
            <Paper
              p="sm"
              radius="md"
              withBorder
              style={{ borderColor: 'var(--mantine-color-primary-filled)' }}
            >
              <Stack gap="xs">
                <Text size="sm" fw={600}>
                  {t('meal.editAllocation')}
                </Text>
                <QuantityFields
                  value={allocValue}
                  unit={allocUnit}
                  onValueChange={setAllocValue}
                  onUnitChange={setAllocUnit}
                  min={0.001}
                />
                <Group>
                  <Button
                    size="xs"
                    loading={savingAllocation}
                    onClick={() => void saveAllocation()}
                  >
                    {t('action.save')}
                  </Button>
                  <Button size="xs" variant="default" onClick={() => setEditComponentId(undefined)}>
                    {t('action.cancel')}
                  </Button>
                </Group>
              </Stack>
            </Paper>
          )}

          {editEventId && (
            <Paper
              p="sm"
              radius="md"
              withBorder
              style={{ borderColor: 'var(--mantine-color-primary-filled)' }}
            >
              <Stack gap="xs">
                <Text size="sm" fw={600}>
                  {t('meal.editPreparation')}
                </Text>
                <QuantityFields
                  valueLabel={t('picker.totalOutput')}
                  value={outputValue}
                  unit={outputUnit}
                  onValueChange={setOutputValue}
                  onUnitChange={setOutputUnit}
                  min={0.001}
                />
                <TextInput
                  label={t('picker.prepDate')}
                  type="date"
                  value={prepDate}
                  onChange={(e) => setPrepDate(e.currentTarget.value)}
                />
                <Group>
                  <Button size="xs" loading={savingPrep} onClick={() => void savePrep()}>
                    {t('action.save')}
                  </Button>
                  <Button size="xs" variant="default" onClick={() => setEditEventId(undefined)}>
                    {t('action.cancel')}
                  </Button>
                </Group>
              </Stack>
            </Paper>
          )}

          <Button leftSection={<Plus size={16} />} onClick={() => setAddOpen(true)}>
            {t('meal.addComponent')}
          </Button>
          <Group gap="xs" wrap="nowrap">
            <Menu shadow="md" width={220} position="top-start">
              <Menu.Target>
                <Button
                  variant="subtle"
                  color="dark"
                  style={{ flex: 1 }}
                  leftSection={<DotsThreeVertical size={16} />}
                >
                  {t('meal.moreActions')}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                {components.length > 0 && (
                  <Menu.Item leftSection={<BookmarkSimple size={16} />} onClick={saveAsFavorite}>
                    {t('meal.saveFavorite')}
                  </Menu.Item>
                )}
                <Menu.Item
                  leftSection={<Star size={16} />}
                  onClick={() => setInsertFavoriteOpen(true)}
                >
                  {t('meal.insertFavorite')}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <Button variant="default" style={{ flex: 1 }} onClick={onClose}>
              {t('recipes.done')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={insertFavoriteOpen}
        onClose={() => setInsertFavoriteOpen(false)}
        title={t('meal.insertFavorite')}
        centered
      >
        <Stack gap="xs">
          {favorites === undefined && (
            <Stack gap={6}>
              <Skeleton height={36} radius="md" />
              <Skeleton height={36} radius="md" />
            </Stack>
          )}
          {favorites?.length === 0 && (
            <Stack gap={6} align="center" py="md">
              <Star size={28} style={{ color: 'var(--mantine-color-dimmed)' }} />
              <Text size="sm" c="dimmed" ta="center">
                {t('meal.noFavorites')}
              </Text>
            </Stack>
          )}
          {favorites?.map((favorite) => (
            <Group key={favorite.id} justify="space-between" wrap="nowrap">
              <Button
                variant="subtle"
                justify="flex-start"
                style={{ flex: 1 }}
                onClick={() => void insertFavorite(favorite.id)}
              >
                {favorite.name} ({favorite.components.length})
              </Button>
              <ActionIcon
                variant="subtle"
                color="error"
                aria-label={t('meal.deleteFavoriteAria', { name: favorite.name })}
                onClick={() => void deleteFavorite(favorite.id, favorite.name)}
              >
                <Trash size={16} />
              </ActionIcon>
            </Group>
          ))}
        </Stack>
      </Modal>

      <AddComponentFlow
        key={addOpen ? `add-${slot.id}` : 'add-closed'}
        opened={addOpen}
        onClose={() => setAddOpen(false)}
        slot={slot}
        graph={graph}
        onOverAllocated={handleOverAllocatedFromAdd}
      />
    </>
  )
}

function FavoriteNameForm({ onSave }: { onSave: (name: string) => Promise<void> }) {
  const { t } = useLocalization()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Stack gap="sm">
      <TextInput
        label={t('common.name')}
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        data-autofocus
      />
      <Group>
        <Button
          loading={busy}
          onClick={() => {
            setBusy(true)
            void onSave(name).finally(() => setBusy(false))
          }}
        >
          {t('action.save')}
        </Button>
        <Button variant="default" onClick={() => modals.closeAll()}>
          {t('action.cancel')}
        </Button>
      </Group>
    </Stack>
  )
}
