import { Alert, Button, Group, Modal, Stack, Text, TextInput, ActionIcon } from '@mantine/core'
import { IconCalendar, IconPencil, IconTrash } from '@tabler/icons-react'
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
import { MEAL_TYPE_LABELS } from '../../domain/shared/MealEnums'
import { hasUnallocatedRemainder } from '../../domain/plans/CookingEventAllocation'
import { useMealFavorites } from '../hooks/useMealFavorites'
import { componentLabel, type SlotComponentDisplay } from '../plans/slotDisplay'
import { AddComponentFlow } from './AddComponentFlow'
import { QuantityFields } from './QuantityFields'
import { useFormatQuantity } from '../localization/useFormatQuantity'

interface MealEditorProps {
  opened: boolean
  onClose: () => void
  slot: MealSlot
  graph: PlanGraph
  components: SlotComponentDisplay[]
}

function planErrorMessage(error: string): string {
  switch (error) {
    case 'over-allocated':
      return 'That uses more than the planned prep output.'
    case 'reuse-forbidden':
      return 'This recipe cannot be reused on that day.'
    case 'before-prep':
      return 'A meal cannot use prep before its scheduled day.'
    case 'incompatible-quantity':
      return 'Quantities use incompatible units.'
    case 'invalid-quantity':
      return 'Enter a valid positive quantity.'
    case 'favorite-missing-ref':
      return 'Favorite references a missing recipe or simple food.'
    default:
      return `Could not update (${error})`
  }
}

function formatDependentLine(date: string, mealType: string): string {
  const label =
    mealType in MEAL_TYPE_LABELS
      ? MEAL_TYPE_LABELS[mealType as keyof typeof MEAL_TYPE_LABELS]
      : mealType
  return `${date} ${label}`
}

function openOverAllocationChoices(args: {
  title?: string
  onIncrease: () => void
  onReduce: () => void
  onCreateAnother?: () => void
}) {
  modals.open({
    title: args.title ?? 'Not enough prep output',
    children: (
      <Stack gap="sm">
        <Text size="sm">This allocation exceeds the planned prep. Choose how to continue:</Text>
        <Button
          onClick={() => {
            modals.closeAll()
            args.onIncrease()
          }}
        >
          Increase cooking quantity
        </Button>
        <Button
          variant="light"
          onClick={() => {
            modals.closeAll()
            args.onReduce()
          }}
        >
          Reduce this allocation
        </Button>
        {args.onCreateAnother && (
          <Button
            variant="light"
            onClick={() => {
              modals.closeAll()
              args.onCreateAnother?.()
            }}
          >
            Create another cooking event
          </Button>
        )}
        <Button variant="default" onClick={() => modals.closeAll()}>
          Cancel
        </Button>
      </Stack>
    ),
  })
}

export function MealEditor({ opened, onClose, slot, graph, components }: MealEditorProps) {
  const { planService, mealFavoriteService } = useServices()
  const favorites = useMealFavorites()
  const formatQty = useFormatQuantity()
  const [addOpen, setAddOpen] = useState(false)
  const [insertFavoriteOpen, setInsertFavoriteOpen] = useState(false)
  const [editComponentId, setEditComponentId] = useState<MealComponentId | undefined>()
  const [editEventId, setEditEventId] = useState<CookingEventId | undefined>()
  const [allocValue, setAllocValue] = useState<number | ''>('')
  const [allocUnit, setAllocUnit] = useState('piece')
  const [outputValue, setOutputValue] = useState<number | ''>('')
  const [outputUnit, setOutputUnit] = useState('piece')
  const [prepDate, setPrepDate] = useState(slot.date)

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
      notifications.show({ message: 'Add components before saving a favorite', color: 'yellow' })
      return
    }
    modals.open({
      title: 'Save as favorite',
      children: (
        <FavoriteNameForm
          onSave={async (name) => {
            const result = await mealFavoriteService.create(name, favoriteComponents)
            if (!result.ok) {
              const message =
                result.error === 'duplicate-name'
                  ? 'A favorite with that name already exists'
                  : result.error === 'empty-name'
                    ? 'Enter a name'
                    : 'Could not save favorite'
              notifications.show({ message, color: 'red' })
              return
            }
            modals.closeAll()
            notifications.show({ message: 'Favorite saved', color: 'green' })
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
            ? `Favorite references a missing item (${result.missingLabel ?? 'unknown'})`
            : planErrorMessage(result.error),
        color: 'red',
      })
      return
    }
    setInsertFavoriteOpen(false)
    notifications.show({ message: `Inserted “${favorite.name}”`, color: 'green' })
  }

  const deleteFavorite = async (favoriteId: string, name: string) => {
    modals.openConfirmModal({
      title: 'Delete favorite',
      children: <Text size="sm">Delete “{name}”? This cannot be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        void mealFavoriteService.delete(favoriteId).then((result) => {
          if (!result.ok) {
            notifications.show({ message: 'Could not delete favorite', color: 'red' })
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
          `${item.cookingEvent.recipeSnapshot.name}: ${formatQty(remaining)} unallocated`,
        )
      }
    }
    return lines
  }, [components, graph, planService, formatQty])

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
    const result = await planService.updateComponentAllocation(editComponentId, allocatedQuantity)
    if (!result.ok) {
      if (result.error === 'over-allocated') {
        const item = components.find((c) => c.component.id === editComponentId)
        const event = item?.cookingEvent
        openOverAllocationChoices({
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
                notifications.show({ message: planErrorMessage(bump.error), color: 'red' })
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
                notifications.show({ message: planErrorMessage(alloc.error), color: 'red' })
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
                    notifications.show({ message: planErrorMessage(created.error), color: 'red' })
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
      notifications.show({ message: planErrorMessage(result.error), color: 'red' })
      return
    }
    setEditComponentId(undefined)
  }

  const savePrep = async () => {
    if (!editEventId || typeof outputValue !== 'number') return
    const result = await planService.updateCookingEvent(editEventId, {
      outputQuantity: { value: outputValue, unit: outputUnit },
      scheduledDate: prepDate,
    })
    if (!result.ok) {
      notifications.show({ message: planErrorMessage(result.error), color: 'red' })
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
      onIncrease: () => {
        void (async () => {
          if (args.kind === 'cook-new' && args.recipeId) {
            const result = await planService.addNewCookingEventComponent(slot.id, args.recipeId, {
              allocatedQuantity: args.allocatedQuantity,
              outputQuantity: args.allocatedQuantity,
              scheduledDate: args.scheduledDate ?? slot.date,
            })
            if (!result.ok) {
              notifications.show({ message: planErrorMessage(result.error), color: 'red' })
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
              notifications.show({ message: planErrorMessage(bump.error), color: 'red' })
              return
            }
            const linked = await planService.linkExistingCookingEvent(slot.id, event.id, {
              allocatedQuantity: args.allocatedQuantity,
            })
            if (!linked.ok) {
              notifications.show({ message: planErrorMessage(linked.error), color: 'red' })
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
                  notifications.show({ message: planErrorMessage(created.error), color: 'red' })
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
          title: 'Remove component',
          children: <Text size="sm">Remove {componentLabel(item)} from this meal?</Text>,
          labels: { confirm: 'Remove', cancel: 'Cancel' },
          confirmProps: { color: 'red' },
          onConfirm: () => {
            void planService.removeComponent(item.component.id).then((result) => {
              if (!result.ok) {
                notifications.show({ message: planErrorMessage(result.error), color: 'red' })
              }
            })
          },
        })
        return
      }

      const eventId = item.component.source.cookingEventId
      const depsResult = await planService.listCookingEventDependents(eventId)
      if (!depsResult.ok) {
        notifications.show({ message: planErrorMessage(depsResult.error), color: 'red' })
        return
      }
      const others = depsResult.dependents.filter((d) => d.componentId !== item.component.id)
      if (others.length === 0) {
        modals.openConfirmModal({
          title: 'Remove component',
          children: <Text size="sm">Remove {componentLabel(item)} from this meal?</Text>,
          labels: { confirm: 'Remove', cancel: 'Cancel' },
          confirmProps: { color: 'red' },
          onConfirm: () => {
            void planService.removeComponent(item.component.id).then((result) => {
              if (!result.ok) {
                notifications.show({ message: planErrorMessage(result.error), color: 'red' })
              }
            })
          },
        })
        return
      }

      modals.open({
        title: 'Shared preparation',
        children: (
          <Stack gap="sm">
            <Text size="sm">This preparation also supplies:</Text>
            <Stack gap={2}>
              {depsResult.dependents.map((d) => (
                <Text key={d.componentId} size="sm">
                  • {formatDependentLine(d.date, d.mealType)}
                </Text>
              ))}
            </Stack>
            <Button
              onClick={() => {
                modals.closeAll()
                void planService.removeComponent(item.component.id).then((result) => {
                  if (!result.ok) {
                    notifications.show({ message: planErrorMessage(result.error), color: 'red' })
                  }
                })
              }}
            >
              Remove from this meal only
            </Button>
            <Button
              color="red"
              variant="light"
              onClick={() => {
                modals.closeAll()
                void planService.removeCookingEventEverywhere(eventId).then((result) => {
                  if (!result.ok) {
                    notifications.show({ message: planErrorMessage(result.error), color: 'red' })
                  }
                })
              }}
            >
              Remove from all affected meals
            </Button>
            <Button variant="default" onClick={() => modals.closeAll()}>
              Cancel
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
        title={`${MEAL_TYPE_LABELS[slot.mealType]} · ${slot.date}`}
        centered
        size="md"
      >
        <Stack gap="sm">
          {unusedWarnings.length > 0 && (
            <Alert color="yellow" title="Unallocated prep">
              {unusedWarnings.map((line) => (
                <Text key={line} size="sm">
                  {line}
                </Text>
              ))}
            </Alert>
          )}

          {components.length === 0 && (
            <Text size="sm" c="dimmed">
              No components yet. Add a recipe or simple food.
            </Text>
          )}

          {components.map((item) => (
            <Stack
              key={item.component.id}
              gap={4}
              p="xs"
              style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 8 }}
            >
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
                  <Text size="sm" fw={600}>
                    {componentLabel(item)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatQty(item.component.allocatedQuantity)}
                    {item.cookingEvent
                      ? ` · prep ${item.cookingEvent.scheduledDate} (${formatQty(item.cookingEvent.outputQuantity)} total)`
                      : ''}
                  </Text>
                </Stack>
                <Group gap={4} wrap="nowrap">
                  <ActionIcon
                    variant="subtle"
                    aria-label="Edit allocation"
                    onClick={() => openEditAllocation(item)}
                  >
                    <IconPencil size={16} />
                  </ActionIcon>
                  {item.cookingEvent && (
                    <ActionIcon
                      variant="subtle"
                      aria-label="Edit prep"
                      onClick={() => openEditPrep(item)}
                    >
                      <IconCalendar size={16} />
                    </ActionIcon>
                  )}
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label="Remove component"
                    onClick={() => confirmRemoveComponent(item)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Group>
            </Stack>
          ))}

          {editComponentId && (
            <Stack gap="xs" p="sm" bg="gray.0" style={{ borderRadius: 8 }}>
              <Text size="sm" fw={600}>
                Edit allocation
              </Text>
              <QuantityFields
                value={allocValue}
                unit={allocUnit}
                onValueChange={setAllocValue}
                onUnitChange={setAllocUnit}
                min={0.001}
              />
              <Group>
                <Button size="xs" onClick={() => void saveAllocation()}>
                  Save
                </Button>
                <Button size="xs" variant="default" onClick={() => setEditComponentId(undefined)}>
                  Cancel
                </Button>
              </Group>
            </Stack>
          )}

          {editEventId && (
            <Stack gap="xs" p="sm" bg="gray.0" style={{ borderRadius: 8 }}>
              <Text size="sm" fw={600}>
                Edit preparation
              </Text>
              <QuantityFields
                valueLabel="Total output"
                value={outputValue}
                unit={outputUnit}
                onValueChange={setOutputValue}
                onUnitChange={setOutputUnit}
                min={0.001}
              />
              <TextInput
                label="Prep date"
                type="date"
                value={prepDate}
                onChange={(e) => setPrepDate(e.currentTarget.value)}
              />
              <Group>
                <Button size="xs" onClick={() => void savePrep()}>
                  Save
                </Button>
                <Button size="xs" variant="default" onClick={() => setEditEventId(undefined)}>
                  Cancel
                </Button>
              </Group>
            </Stack>
          )}

          <Button onClick={() => setAddOpen(true)}>+ Component</Button>
          {components.length > 0 && (
            <Button variant="light" onClick={saveAsFavorite}>
              Save as favorite
            </Button>
          )}
          <Button variant="light" onClick={() => setInsertFavoriteOpen(true)}>
            Insert favorite
          </Button>
          <Button variant="default" onClick={onClose}>
            Done
          </Button>
        </Stack>
      </Modal>

      <Modal
        opened={insertFavoriteOpen}
        onClose={() => setInsertFavoriteOpen(false)}
        title="Insert favorite"
        centered
      >
        <Stack gap="xs">
          {(favorites?.length ?? 0) === 0 && (
            <Text size="sm" c="dimmed">
              No saved favorites yet.
            </Text>
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
                color="red"
                aria-label={`Delete ${favorite.name}`}
                onClick={() => void deleteFavorite(favorite.id, favorite.name)}
              >
                <IconTrash size={16} />
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
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Stack gap="sm">
      <TextInput
        label="Name"
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
          Save
        </Button>
        <Button variant="default" onClick={() => modals.closeAll()}>
          Cancel
        </Button>
      </Group>
    </Stack>
  )
}
