import { Alert, Button, Modal, Stack, Text, TextInput, UnstyledButton } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMemo, useState } from 'react'
import { DishCatalog } from '../catalog/DishCatalog'
import {
  defaultDishCatalogFilters,
  leftoverToCatalogItem,
  recipeToCatalogItem,
  simpleFoodToCatalogItem,
  type DishCatalogFilters,
  type DishCatalogItem,
  type IngredientFilterOption,
} from '../catalog/catalogModel'
import { useServices } from '../../app/servicesContext'
import type { CookingEvent } from '../../domain/plans/CookingEvent'
import {
  rankComponentSuggestions,
  type SuggestionCandidate,
} from '../../domain/plans/componentSuggestions'
import type { MealSlot } from '../../domain/plans/MealSlot'
import type { PlanGraph } from '../../domain/plans/PlanGraph'
import { DEFAULT_CATALOG_SORT } from '../../domain/shared/MealEnums'
import type { Quantity } from '../../domain/shared/Quantity'
import { addDays } from '../../domain/shared/LocalDate'
import { hasUnallocatedRemainder, isReuseAllowed } from '../../domain/plans/CookingEventAllocation'
import { useIngredients } from '../hooks/useIngredients'
import { useMealFavorites } from '../hooks/useMealFavorites'
import { usePairings } from '../hooks/usePairings'
import { useRecipes } from '../hooks/useRecipes'
import { useSettings } from '../hooks/useSettings'
import { useSimpleFoods } from '../hooks/useSimpleFoods'
import { useTags } from '../hooks/useTags'
import { usePlanByStartDate } from '../hooks/usePlanByStartDate'
import { QuantityFields } from './QuantityFields'
import { useFormatQuantity } from '../localization/useFormatQuantity'
import { useIngredientLabel } from '../localization/useIngredientLabel'

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

function reasonLabel(reason: SuggestionCandidate['reason']): string | null {
  switch (reason) {
    case 'pairing':
      return 'Pairs well'
    case 'favorite':
      return 'From a favorite'
    case 'role':
      return 'Good role fit'
    case 'variety':
      return 'Variety / veg'
    default:
      return null
  }
}

export function AddComponentFlow({
  opened,
  onClose,
  slot,
  graph,
  onOverAllocated,
}: AddComponentFlowProps) {
  const { planService, settingsRepository } = useServices()
  const recipes = useRecipes()
  const simpleFoods = useSimpleFoods()
  const tags = useTags()
  const ingredients = useIngredients()
  const favorites = useMealFavorites()
  const pairings = usePairings()
  const settings = useSettings()
  const sort = settings?.catalogSort ?? DEFAULT_CATALOG_SORT
  const formatQty = useFormatQuantity()
  const ingredientLabel = useIngredientLabel()
  const previousWeekStart = addDays(graph.plan.startDate, -7)
  const previousWeek = usePlanByStartDate(previousWeekStart)

  const [filters, setFilters] = useState<DishCatalogFilters>(() =>
    defaultDishCatalogFilters('all', false),
  )
  const [step, setStep] = useState<Step>({ kind: 'pick' })
  const [allocValue, setAllocValue] = useState<number | ''>('')
  const [allocUnit, setAllocUnit] = useState('piece')
  const [outputValue, setOutputValue] = useState<number | ''>('')
  const [outputUnit, setOutputUnit] = useState('piece')
  const [prepDate, setPrepDate] = useState(slot.date)
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)

  const previousWeekRecipeIds = useMemo(() => {
    const ids = new Set<string>()
    if (!previousWeek) return ids
    for (const event of previousWeek.cookingEvents) {
      ids.add(event.recipeId)
    }
    return ids
  }, [previousWeek])

  const tagNamesById = useMemo(() => {
    const map = new Map<string, string>()
    for (const tag of tags ?? []) map.set(tag.id, tag.name)
    return map
  }, [tags])

  const ingredientOptions = useMemo((): IngredientFilterOption[] => {
    return (ingredients ?? []).map((ingredient) => ({
      id: ingredient.id,
      label: ingredientLabel(ingredient),
      searchText: [
        ingredient.name,
        ingredientLabel(ingredient),
        ...ingredient.aliases,
        ...(ingredient.localizedAliases ?? []).map((alias) => alias.text),
        ...(ingredient.preferredLabels ?? []).map((entry) => entry.label),
      ].join(' '),
    }))
  }, [ingredients, ingredientLabel])

  const ranked = useMemo(() => {
    if (!recipes || !simpleFoods || !favorites || !pairings || !settings) return []
    return rankComponentSuggestions({
      slotMealType: slot.mealType,
      graph,
      slotId: slot.id,
      recipes,
      simpleFoods,
      pairings,
      favorites,
      settings,
      previousWeekRecipeIds,
      query: '',
      tagNamesById,
    })
  }, [
    recipes,
    simpleFoods,
    favorites,
    pairings,
    settings,
    graph,
    slot,
    previousWeekRecipeIds,
    tagNamesById,
  ])

  const catalogItems = useMemo((): DishCatalogItem[] => {
    return ranked
      .map((item) => {
        const hint = reasonLabel(item.reason)
        if (item.kind === 'recipe') {
          const recipe = recipes?.find((r) => r.id === item.id)
          if (!recipe) return null
          return recipeToCatalogItem(recipe, tagNamesById, {
            score: item.score,
            reason: item.reason,
            subtitle: hint ? `Recipe · ${hint}` : 'Recipe',
          })
        }
        const food = simpleFoods?.find((f) => f.id === item.id)
        if (!food) return null
        return simpleFoodToCatalogItem(food, tagNamesById, {
          score: item.score,
          reason: item.reason,
          subtitle: hint ? `Simple food · ${hint}` : 'Simple food',
        })
      })
      .filter((item): item is DishCatalogItem => item !== null)
  }, [ranked, recipes, simpleFoods, tagNamesById])

  const leftovers = useMemo((): DishCatalogItem[] => {
    const rows: DishCatalogItem[] = []
    for (const event of graph.cookingEvents) {
      const remaining = planService.remainingForCookingEvent(graph, event.id)
      if (!hasUnallocatedRemainder(remaining) || !remaining) continue
      const eligible = isReuseAllowed(
        event.recipeSnapshot.reusePolicy,
        event.scheduledDate,
        slot.date,
      )
      const ineligibleReason = eligible
        ? undefined
        : `Same-day only — cooked ${event.scheduledDate}`
      rows.push(leftoverToCatalogItem(event, remaining, ineligibleReason))
    }
    return rows
  }, [graph, planService, slot.date])

  const handleClose = () => {
    onClose()
  }

  const pickRecipe = async (recipeId: string, recipeName: string) => {
    setStep({ kind: 'source', recipeId, recipeName })
  }

  const pickLeftover = async (item: DishCatalogItem) => {
    const event = item.cookingEvent
    if (!event) return
    if (item.ineligibleReason) {
      notifications.show({ message: item.ineligibleReason, color: 'red' })
      return
    }
    const result = await planService.listEligibleCookingEventsForSlot(slot.id, event.recipeId)
    if (!result.ok) {
      notifications.show({ message: errorMessage(result.error), color: 'red' })
      return
    }
    const events = result.events.length > 0 ? result.events : [event]
    const remainingById = new Map<string, Quantity | null>()
    for (const candidate of events) {
      remainingById.set(candidate.id, planService.remainingForCookingEvent(graph, candidate.id))
    }
    const selected = events.find((candidate) => candidate.id === event.id) ?? events[0]
    setSelectedEventId(selected.id)
    const remaining = remainingById.get(selected.id)
    setAllocValue(
      remaining && remaining.value > 0 ? remaining.value : selected.outputQuantity.value,
    )
    setAllocUnit(selected.outputQuantity.unit)
    setStep({
      kind: 'use-existing',
      recipeId: event.recipeId,
      recipeName: event.recipeSnapshot.name,
      events,
      remainingById,
    })
  }

  const pickCatalogItem = (item: DishCatalogItem) => {
    if (item.kind === 'leftover') {
      void pickLeftover(item)
      return
    }
    if (item.kind === 'recipe') {
      void pickRecipe(item.id, item.name)
      return
    }
    void pickSimpleFood(item.id)
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
      ? 'Add dish'
      : step.kind === 'source'
        ? step.recipeName
        : step.kind === 'cook-new'
          ? `Cook new — ${step.recipeName}`
          : `Use existing — ${step.recipeName}`

  return (
    <Modal opened={opened} onClose={handleClose} title={title} centered size="lg">
      <Stack gap="sm">
        {step.kind === 'pick' && (
          <DishCatalog
            items={catalogItems}
            leftovers={leftovers}
            filters={filters}
            onFiltersChange={setFilters}
            tagNamesById={tagNamesById}
            sort={sort}
            onSortChange={(next) => void settingsRepository.update({ catalogSort: next })}
            onSelect={pickCatalogItem}
            disabled={busy}
            showSuggestedFilter
            ingredientOptions={ingredientOptions}
            pickerSections
          />
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
            <Text size="sm">Choose prep with remaining output:</Text>
            <Stack gap={4}>
              {step.events.map((event) => {
                const remaining = step.remainingById.get(event.id)
                const selected = selectedEventId === event.id
                return (
                  <UnstyledButton
                    key={event.id}
                    onClick={() => {
                      setSelectedEventId(event.id)
                      setAllocValue(
                        remaining && remaining.value > 0
                          ? remaining.value
                          : event.outputQuantity.value,
                      )
                      setAllocUnit(event.outputQuantity.unit)
                    }}
                    p="xs"
                    style={{
                      borderRadius: 4,
                      border: selected
                        ? '1px solid var(--mantine-color-blue-5)'
                        : '1px solid transparent',
                    }}
                  >
                    <Text size="sm">
                      {event.scheduledDate} · {formatQty(event.outputQuantity)} total
                      {remaining ? ` · ${formatQty(remaining)} left` : ''}
                    </Text>
                  </UnstyledButton>
                )
              })}
            </Stack>
            <QuantityFields
              valueLabel="Allocated to this meal"
              value={allocValue}
              unit={allocUnit}
              onValueChange={setAllocValue}
              onUnitChange={setAllocUnit}
              min={0.001}
            />
            {!selectedEventId && <Alert color="yellow">Select a prep event.</Alert>}
            <Button
              loading={busy}
              disabled={!selectedEventId}
              onClick={() => void confirmUseExisting()}
            >
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
      </Stack>
    </Modal>
  )
}
