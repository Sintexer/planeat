import {
  Alert,
  Button,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core'
import { CaretRight, Check, CookingPot, Package, Warning } from '@phosphor-icons/react'
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
import {
  formatWhyThis,
  isPlannedThisWeek,
  matchingFavoriteName,
  pairingPartnerName,
  pickerWhyThisCopy,
} from '../catalog/pickerWhyThis'
import { useServices } from '../../app/servicesContext'
import type { CookingEvent } from '../../domain/plans/CookingEvent'
import { rankComponentSuggestions } from '../../domain/plans/componentSuggestions'
import type { MealSlot } from '../../domain/plans/MealSlot'
import type { PlanGraph } from '../../domain/plans/PlanGraph'
import { DEFAULT_CATALOG_SORT, type CatalogSort } from '../../domain/shared/MealEnums'
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
import { archivedTagIdSet } from '../../domain/tags/Tag'
import { usePlanByStartDate } from '../hooks/usePlanByStartDate'
import { QuantityFields } from './QuantityFields'
import { useFormatQuantity } from '../localization/useFormatQuantity'
import { useIngredientLabel } from '../localization/useIngredientLabel'
import { useLocalization } from '../localization/LocalizationContext'
import { addComponentErrorMessage } from '../localization/errors'

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

function defaultPickerFilters(): DishCatalogFilters {
  return defaultDishCatalogFilters('all', false)
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
  const tags = useTags()
  const ingredients = useIngredients()
  const favorites = useMealFavorites()
  const pairings = usePairings()
  const settings = useSettings()
  const formatQty = useFormatQuantity()
  const ingredientLabel = useIngredientLabel()
  const { t, bcp47 } = useLocalization()
  const previousWeekStart = addDays(graph.plan.startDate, -7)
  const previousWeek = usePlanByStartDate(previousWeekStart)

  const [filters, setFilters] = useState<DishCatalogFilters>(defaultPickerFilters)
  const [sort, setSort] = useState<CatalogSort>(DEFAULT_CATALOG_SORT)
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
  const archivedTagIds = useMemo(() => archivedTagIdSet(tags ?? []), [tags])

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

  const currentRecipeIds = useMemo(() => {
    const ids = new Set<string>()
    for (const component of graph.components) {
      if (component.slotId !== slot.id) continue
      const source = component.source
      if (source.type !== 'cooking-event') continue
      const event = graph.cookingEvents.find((candidate) => candidate.id === source.cookingEventId)
      if (event) ids.add(event.recipeId)
    }
    return ids
  }, [graph, slot.id])

  const recipeNamesById = useMemo(() => {
    const map = new Map<string, string>()
    for (const recipe of recipes ?? []) map.set(recipe.id, recipe.name)
    return map
  }, [recipes])

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
    if (!favorites || !pairings) return []
    return ranked
      .map((item) => {
        const why = formatWhyThis(
          t,
          pickerWhyThisCopy({
            kind: item.kind,
            reason: item.reason,
            pairingPartnerName: pairingPartnerName({
              candidateKind: item.kind,
              candidateId: item.id,
              currentRecipeIds,
              pairings,
              recipeNamesById,
              locale: bcp47,
            }),
            favoriteName: matchingFavoriteName({
              candidateKind: item.kind,
              candidateId: item.id,
              currentRecipeIds,
              favorites,
            }),
            plannedThisWeek: isPlannedThisWeek(item.kind, item.id, graph),
          }),
        )
        if (item.kind === 'recipe') {
          const recipe = recipes?.find((r) => r.id === item.id)
          if (!recipe) return null
          return recipeToCatalogItem(recipe, tagNamesById, {
            score: item.score,
            reason: item.reason,
            subtitle: why,
          })
        }
        const food = simpleFoods?.find((f) => f.id === item.id)
        if (!food) return null
        return simpleFoodToCatalogItem(food, tagNamesById, {
          score: item.score,
          reason: item.reason,
          subtitle: why,
        })
      })
      .filter((item): item is DishCatalogItem => item !== null)
  }, [
    ranked,
    recipes,
    simpleFoods,
    tagNamesById,
    favorites,
    pairings,
    currentRecipeIds,
    recipeNamesById,
    graph,
    t,
    bcp47,
  ])

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
        : t('picker.sameDayIneligible', { date: event.scheduledDate })
      rows.push(leftoverToCatalogItem(event, remaining, ineligibleReason))
    }
    return rows
  }, [graph, planService, slot.date, t])

  const resetPickerBrowseState = () => {
    setFilters(defaultPickerFilters())
    setSort(DEFAULT_CATALOG_SORT)
  }

  const handleClose = () => {
    resetPickerBrowseState()
    setStep({ kind: 'pick' })
    onClose()
  }

  const pickRecipe = async (recipeId: string, recipeName: string) => {
    setStep({ kind: 'source', recipeId, recipeName })
  }

  const pickLeftover = async (item: DishCatalogItem) => {
    const event = item.cookingEvent
    if (!event) return
    if (item.ineligibleReason) {
      notifications.show({ message: item.ineligibleReason, color: 'error' })
      return
    }
    const result = await planService.listEligibleCookingEventsForSlot(slot.id, event.recipeId)
    if (!result.ok) {
      notifications.show({ message: addComponentErrorMessage(t, result.error), color: 'error' })
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
      notifications.show({ message: addComponentErrorMessage(t, result.error), color: 'error' })
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
      notifications.show({ message: addComponentErrorMessage(t, result.error), color: 'error' })
      return
    }
    if (result.events.length === 0) {
      notifications.show({
        message: t('picker.noEligiblePrep'),
        color: 'warning',
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
      notifications.show({
        message: addComponentErrorMessage(t, 'invalid-quantity'),
        color: 'error',
      })
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
      notifications.show({ message: addComponentErrorMessage(t, result.error), color: 'error' })
      return
    }
    handleClose()
  }

  const confirmUseExisting = async () => {
    if (step.kind !== 'use-existing' || !selectedEventId) return
    if (typeof allocValue !== 'number') {
      notifications.show({
        message: addComponentErrorMessage(t, 'invalid-quantity'),
        color: 'error',
      })
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
      notifications.show({ message: addComponentErrorMessage(t, result.error), color: 'error' })
      return
    }
    handleClose()
  }

  const title =
    step.kind === 'pick'
      ? t('slot.addDish')
      : step.kind === 'source'
        ? step.recipeName
        : step.kind === 'cook-new'
          ? t('picker.cookNewTitle', { name: step.recipeName })
          : t('picker.useExistingTitle', { name: step.recipeName })

  const catalogLoading = !recipes || !simpleFoods || !favorites || !pairings || !settings

  return (
    <Modal opened={opened} onClose={handleClose} title={title} centered size="lg">
      <Stack gap="sm">
        {step.kind === 'pick' && (
          <div key={step.kind} className="step-transition">
            <DishCatalog
              items={catalogItems}
              leftovers={leftovers}
              filters={filters}
              onFiltersChange={setFilters}
              tagNamesById={tagNamesById}
              archivedTagIds={archivedTagIds}
              sort={sort}
              onSortChange={setSort}
              onSelect={pickCatalogItem}
              disabled={busy}
              loading={catalogLoading}
              showSuggestedFilter
              ingredientOptions={ingredientOptions}
              pickerSections
            />
          </div>
        )}

        {step.kind === 'source' && (
          <div key={step.kind} className="step-transition">
            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                {t('picker.sourceQuestion')}
              </Text>
              <UnstyledButton className="selectable-row" onClick={() => void startCookNew()}>
                <Paper withBorder radius="md" p="sm">
                  <Group wrap="nowrap" gap="sm">
                    <ThemeIcon size={36} radius="xl" variant="light" color="primary">
                      <CookingPot size={18} />
                    </ThemeIcon>
                    <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                      <Text size="sm" fw={600}>
                        {t('picker.cookNew')}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {t('picker.cookNewHint')}
                      </Text>
                    </Stack>
                    <CaretRight size={16} style={{ color: 'var(--mantine-color-dimmed)' }} />
                  </Group>
                </Paper>
              </UnstyledButton>
              <UnstyledButton className="selectable-row" onClick={() => void startUseExisting()}>
                <Paper withBorder radius="md" p="sm">
                  <Group wrap="nowrap" gap="sm">
                    <ThemeIcon size={36} radius="xl" variant="light" color="secondary">
                      <Package size={18} />
                    </ThemeIcon>
                    <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                      <Text size="sm" fw={600}>
                        {t('picker.useExisting')}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {t('picker.useExistingHint')}
                      </Text>
                    </Stack>
                    <CaretRight size={16} style={{ color: 'var(--mantine-color-dimmed)' }} />
                  </Group>
                </Paper>
              </UnstyledButton>
              <Button variant="subtle" color="dark" onClick={() => setStep({ kind: 'pick' })}>
                {t('action.back')}
              </Button>
            </Stack>
          </div>
        )}

        {step.kind === 'cook-new' && (
          <div key={step.kind} className="step-transition">
            <Stack gap="sm">
              <QuantityFields
                valueLabel={t('picker.allocated')}
                value={allocValue}
                unit={allocUnit}
                onValueChange={setAllocValue}
                onUnitChange={setAllocUnit}
                min={0.001}
              />
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
              <Button loading={busy} onClick={() => void confirmCookNew()}>
                {t('action.add')}
              </Button>
              <Button
                variant="default"
                onClick={() =>
                  setStep({ kind: 'source', recipeId: step.recipeId, recipeName: step.recipeName })
                }
              >
                {t('action.back')}
              </Button>
            </Stack>
          </div>
        )}

        {step.kind === 'use-existing' && (
          <div key={step.kind} className="step-transition">
            <Stack gap="sm">
              <Text size="sm">{t('picker.choosePrep')}</Text>
              <Stack gap={6}>
                {step.events.map((event) => {
                  const remaining = step.remainingById.get(event.id)
                  const selected = selectedEventId === event.id
                  return (
                    <UnstyledButton
                      key={event.id}
                      className="selectable-row"
                      data-selected={selected}
                      onClick={() => {
                        setSelectedEventId(event.id)
                        setAllocValue(
                          remaining && remaining.value > 0
                            ? remaining.value
                            : event.outputQuantity.value,
                        )
                        setAllocUnit(event.outputQuantity.unit)
                      }}
                    >
                      <Paper withBorder radius="md" p="xs">
                        <Group justify="space-between" wrap="nowrap">
                          <Text size="sm">
                            {event.scheduledDate} · {formatQty(event.outputQuantity)} total
                            {remaining ? ` · ${formatQty(remaining)} left` : ''}
                          </Text>
                          {selected && (
                            <Check
                              size={16}
                              style={{
                                color: 'var(--mantine-color-primary-filled)',
                                flexShrink: 0,
                              }}
                            />
                          )}
                        </Group>
                      </Paper>
                    </UnstyledButton>
                  )
                })}
              </Stack>
              <QuantityFields
                valueLabel={t('picker.allocated')}
                value={allocValue}
                unit={allocUnit}
                onValueChange={setAllocValue}
                onUnitChange={setAllocUnit}
                min={0.001}
              />
              {!selectedEventId && (
                <Alert color="warning" icon={<Warning size={16} />}>
                  {t('picker.selectPrep')}
                </Alert>
              )}
              <Button
                loading={busy}
                disabled={!selectedEventId}
                onClick={() => void confirmUseExisting()}
              >
                {t('action.add')}
              </Button>
              <Button
                variant="default"
                onClick={() =>
                  setStep({ kind: 'source', recipeId: step.recipeId, recipeName: step.recipeName })
                }
              >
                {t('action.back')}
              </Button>
            </Stack>
          </div>
        )}
      </Stack>
    </Modal>
  )
}
