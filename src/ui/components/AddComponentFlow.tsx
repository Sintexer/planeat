import {
  Alert,
  Button,
  Checkbox,
  Modal,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMemo, useState } from 'react'
import { useServices } from '../../app/servicesContext'
import type { CookingEvent } from '../../domain/plans/CookingEvent'
import type { MealSlot } from '../../domain/plans/MealSlot'
import type { PlanGraph } from '../../domain/plans/PlanGraph'
import type { Quantity } from '../../domain/shared/Quantity'
import { formatQuantity } from '../../domain/shared/formatQuantity'
import { useRecipes } from '../hooks/useRecipes'
import { useSimpleFoods } from '../hooks/useSimpleFoods'
import { QuantityFields } from './QuantityFields'

type Step =
  | { kind: 'pick' }
  | { kind: 'source'; recipeId: string; recipeName: string }
  | { kind: 'cook-new'; recipeId: string; recipeName: string; defaultQty: Quantity }
  | {
      kind: 'use-existing'
      recipeId: string
      recipeName: string
      events: CookingEvent[]
      remainingById: Map<string, Quantity | null>
    }

interface AddComponentFlowProps {
  opened: boolean
  onClose: () => void
  slot: MealSlot
  graph: PlanGraph
  onOverAllocated: (args: {
    kind: 'link' | 'cook-new'
    cookingEventId?: string
    recipeId?: string
    allocatedQuantity: Quantity
    outputQuantity?: Quantity
    scheduledDate?: string
  }) => void
}

function errorMessage(error: string): string {
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
    default:
      return `Could not add component (${error})`
  }
}

export function AddComponentFlow({
  opened,
  onClose,
  slot,
  graph,
  onOverAllocated,
}: AddComponentFlowProps) {
  const { planService } = useServices()
  const recipes = useRecipes()
  const simpleFoods = useSimpleFoods()
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [step, setStep] = useState<Step>({ kind: 'pick' })
  const [allocValue, setAllocValue] = useState<number | ''>('')
  const [allocUnit, setAllocUnit] = useState('piece')
  const [outputValue, setOutputValue] = useState<number | ''>('')
  const [outputUnit, setOutputUnit] = useState('piece')
  const [prepDate, setPrepDate] = useState(slot.date)
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)

  const filteredRecipes = useMemo(() => {
    if (!recipes) return []
    const q = query.trim().toLowerCase()
    return recipes.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false
      if (!showAll && !r.mealTypes.includes(slot.mealType)) return false
      return true
    })
  }, [recipes, query, showAll, slot.mealType])

  const filteredSimpleFoods = useMemo(() => {
    if (!simpleFoods) return []
    const q = query.trim().toLowerCase()
    return simpleFoods.filter((s) => {
      if (!s.enabledInSuggestions) return false
      if (q && !s.name.toLowerCase().includes(q)) return false
      if (!showAll && !s.mealTypes.includes(slot.mealType)) return false
      return true
    })
  }, [simpleFoods, query, showAll, slot.mealType])

  const handleClose = () => {
    onClose()
  }

  const pickRecipe = async (recipeId: string, recipeName: string) => {
    setStep({ kind: 'source', recipeId, recipeName })
  }

  const pickSimpleFood = async (simpleFoodId: string) => {
    setBusy(true)
    const result = await planService.addSimpleFoodComponent(slot.id, simpleFoodId)
    setBusy(false)
    if (!result.ok) {
      notifications.show({ message: errorMessage(result.error), color: 'red' })
      return
    }
    handleClose()
  }

  const startCookNew = async () => {
    if (step.kind !== 'source') return
    const recipe = recipes?.find((r) => r.id === step.recipeId)
    if (!recipe) return
    const defaultQty = {
      value: recipe.defaultPortionPerPerson.value * graph.plan.peopleCount,
      unit: recipe.defaultPortionPerPerson.unit,
    }
    // Use service scale via known people count — keep local default for form
    setAllocValue(defaultQty.value)
    setAllocUnit(defaultQty.unit)
    setOutputValue(defaultQty.value)
    setOutputUnit(defaultQty.unit)
    setPrepDate(slot.date)
    setStep({
      kind: 'cook-new',
      recipeId: step.recipeId,
      recipeName: step.recipeName,
      defaultQty,
    })
  }

  const startUseExisting = async () => {
    if (step.kind !== 'source') return
    const result = await planService.listEligibleCookingEventsForSlot(slot.id, step.recipeId)
    if (!result.ok) {
      notifications.show({ message: errorMessage(result.error), color: 'red' })
      return
    }
    if (result.events.length === 0) {
      notifications.show({
        message: 'No eligible prep in this plan with remaining output.',
        color: 'yellow',
      })
      return
    }
    const remainingById = new Map<string, Quantity | null>()
    for (const event of result.events) {
      remainingById.set(event.id, planService.remainingForCookingEvent(graph, event.id))
    }
    const first = result.events[0]
    setSelectedEventId(first.id)
    const remaining = remainingById.get(first.id)
    setAllocValue(remaining && remaining.value > 0 ? remaining.value : first.outputQuantity.value)
    setAllocUnit(first.outputQuantity.unit)
    setStep({
      kind: 'use-existing',
      recipeId: step.recipeId,
      recipeName: step.recipeName,
      events: result.events,
      remainingById,
    })
  }

  const confirmCookNew = async () => {
    if (step.kind !== 'cook-new') return
    if (typeof allocValue !== 'number' || typeof outputValue !== 'number') {
      notifications.show({ message: errorMessage('invalid-quantity'), color: 'red' })
      return
    }
    const allocatedQuantity = { value: allocValue, unit: allocUnit }
    const outputQuantity = { value: outputValue, unit: outputUnit }
    setBusy(true)
    const result = await planService.addNewCookingEventComponent(slot.id, step.recipeId, {
      allocatedQuantity,
      outputQuantity,
      scheduledDate: prepDate,
    })
    setBusy(false)
    if (!result.ok) {
      if (result.error === 'over-allocated') {
        onOverAllocated({
          kind: 'cook-new',
          recipeId: step.recipeId,
          allocatedQuantity,
          outputQuantity,
          scheduledDate: prepDate,
        })
        return
      }
      notifications.show({ message: errorMessage(result.error), color: 'red' })
      return
    }
    handleClose()
  }

  const confirmUseExisting = async () => {
    if (step.kind !== 'use-existing' || !selectedEventId) return
    if (typeof allocValue !== 'number') {
      notifications.show({ message: errorMessage('invalid-quantity'), color: 'red' })
      return
    }
    const allocatedQuantity = { value: allocValue, unit: allocUnit }
    setBusy(true)
    const result = await planService.linkExistingCookingEvent(slot.id, selectedEventId, {
      allocatedQuantity,
    })
    setBusy(false)
    if (!result.ok) {
      if (result.error === 'over-allocated') {
        onOverAllocated({
          kind: 'link',
          cookingEventId: selectedEventId,
          allocatedQuantity,
        })
        return
      }
      notifications.show({ message: errorMessage(result.error), color: 'red' })
      return
    }
    handleClose()
  }

  const title =
    step.kind === 'pick'
      ? 'Add component'
      : step.kind === 'source'
        ? step.recipeName
        : step.kind === 'cook-new'
          ? `Cook new — ${step.recipeName}`
          : `Use existing — ${step.recipeName}`

  return (
    <Modal opened={opened} onClose={handleClose} title={title} centered>
      <Stack gap="sm">
        {step.kind === 'pick' && (
          <>
            <TextInput
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              data-autofocus
            />
            <Checkbox
              label="Show all meal types"
              checked={showAll}
              onChange={(e) => setShowAll(e.currentTarget.checked)}
            />
            <Text size="sm" fw={600}>
              Recipes
            </Text>
            {filteredRecipes.length === 0 && (
              <Text size="sm" c="dimmed">
                No matching recipes.
              </Text>
            )}
            <Stack gap={4}>
              {filteredRecipes.map((recipe) => (
                <UnstyledButton
                  key={recipe.id}
                  onClick={() => void pickRecipe(recipe.id, recipe.name)}
                  p="xs"
                  style={{ borderRadius: 4 }}
                >
                  <Text size="sm">{recipe.name}</Text>
                </UnstyledButton>
              ))}
            </Stack>
            <Text size="sm" fw={600} mt="xs">
              Simple foods
            </Text>
            {filteredSimpleFoods.length === 0 && (
              <Text size="sm" c="dimmed">
                No matching simple foods.
              </Text>
            )}
            <Stack gap={4}>
              {filteredSimpleFoods.map((food) => (
                <UnstyledButton
                  key={food.id}
                  disabled={busy}
                  onClick={() => void pickSimpleFood(food.id)}
                  p="xs"
                  style={{ borderRadius: 4 }}
                >
                  <Text size="sm">{food.name}</Text>
                </UnstyledButton>
              ))}
            </Stack>
          </>
        )}

        {step.kind === 'source' && (
          <>
            <Text size="sm">How should this component be sourced?</Text>
            <Button onClick={() => void startCookNew()}>Cook new (this prep)</Button>
            <Button variant="light" onClick={() => void startUseExisting()}>
              Use existing prep in this plan
            </Button>
            <Button variant="default" onClick={() => setStep({ kind: 'pick' })}>
              Back
            </Button>
          </>
        )}

        {step.kind === 'cook-new' && (
          <>
            <QuantityFields
              valueLabel="Allocated to this meal"
              value={allocValue}
              unit={allocUnit}
              onValueChange={setAllocValue}
              onUnitChange={setAllocUnit}
              min={0.001}
            />
            <QuantityFields
              valueLabel="Total prep output"
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
            <Button loading={busy} onClick={() => void confirmCookNew()}>
              Add
            </Button>
            <Button
              variant="default"
              onClick={() =>
                setStep({ kind: 'source', recipeId: step.recipeId, recipeName: step.recipeName })
              }
            >
              Back
            </Button>
          </>
        )}

        {step.kind === 'use-existing' && (
          <>
            <Stack gap={4}>
              {step.events.map((event) => {
                const remaining = step.remainingById.get(event.id)
                return (
                  <UnstyledButton
                    key={event.id}
                    onClick={() => {
                      setSelectedEventId(event.id)
                      if (remaining && remaining.value > 0) {
                        setAllocValue(remaining.value)
                        setAllocUnit(remaining.unit)
                      } else {
                        setAllocValue(event.outputQuantity.value)
                        setAllocUnit(event.outputQuantity.unit)
                      }
                    }}
                    p="xs"
                    style={{
                      borderRadius: 4,
                      outline:
                        selectedEventId === event.id
                          ? '2px solid var(--mantine-color-blue-5)'
                          : undefined,
                    }}
                  >
                    <Text size="sm" fw={500}>
                      Prep {event.scheduledDate}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Output {formatQuantity(event.outputQuantity)}
                      {remaining ? ` · remaining ${formatQuantity(remaining)}` : ''}
                    </Text>
                  </UnstyledButton>
                )
              })}
            </Stack>
            <QuantityFields
              valueLabel="Allocate to this meal"
              value={allocValue}
              unit={allocUnit}
              onValueChange={setAllocValue}
              onUnitChange={setAllocUnit}
              min={0.001}
            />
            <Button loading={busy} onClick={() => void confirmUseExisting()}>
              Add
            </Button>
            <Button
              variant="default"
              onClick={() =>
                setStep({ kind: 'source', recipeId: step.recipeId, recipeName: step.recipeName })
              }
            >
              Back
            </Button>
          </>
        )}

        {step.kind === 'pick' && (
          <Button variant="default" onClick={handleClose}>
            Cancel
          </Button>
        )}

        {step.kind === 'source' && (
          <Alert color="gray" variant="light">
            Fresh-only and same-day recipes can only be used on their prep day. Batch-friendly
            recipes can feed later meals in this plan.
          </Alert>
        )}
      </Stack>
    </Modal>
  )
}
