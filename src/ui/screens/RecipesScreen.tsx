import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Modal,
  MultiSelect,
  Paper,
  Select,
  Stack,
  TagsInput,
  Text,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { IconFileImport, IconPlus, IconCarrot, IconApple, IconTag } from '@tabler/icons-react'
import { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useServices } from '../../app/servicesContext'
import {
  DEFAULT_CATALOG_GROUP,
  DEFAULT_CATALOG_SORT,
  type CatalogGroup,
  type CatalogSort,
} from '../../domain/shared/MealEnums'
import {
  findStaleLibraryViewRefs,
  libraryViewCriteriaEquals,
  skipIdsForMatching,
  LIBRARY_CLEANUP_KINDS,
  type LibraryCleanupKind,
  type LibraryView,
  type LibraryViewId,
} from '../../domain/libraryViews/LibraryView'
import { DishCatalog } from '../catalog/DishCatalog'
import { LibraryViewsBar } from '../catalog/LibraryViewsBar'
import {
  catalogBrowseFromCriteria,
  criteriaFromCatalogBrowse,
  defaultDishCatalogFilters,
  recipeToCatalogItem,
  simpleFoodToCatalogItem,
  type DishCatalogFilters,
  type DishCatalogItem,
  type IngredientFilterOption,
} from '../catalog/catalogModel'
import { PageTitle } from '../components/ScreenHeader'
import { useIngredients } from '../hooks/useIngredients'
import { useLibraryViews } from '../hooks/useLibraryViews'
import { useRecipes } from '../hooks/useRecipes'
import { useSettings } from '../hooks/useSettings'
import { useSimpleFoods } from '../hooks/useSimpleFoods'
import { useTags } from '../hooks/useTags'
import { archivedTagIdSet, tagCreateAutocompleteNames } from '../../domain/tags/Tag'
import type { CatalogTagItemRef } from '../../application/tags/TagService'
import { useFormatQuantity } from '../localization/useFormatQuantity'
import { useIngredientLabel } from '../localization/useIngredientLabel'
import { useLocalization } from '../localization/LocalizationContext'
import { cleanupLabel, effortLabel } from '../localization/labels'
import type { Translate } from '../localization/t'
import { recipesBrowseState } from './recipesBrowseState'

function viewErrorMessage(
  t: Translate,
  error: 'empty-name' | 'name-collision' | 'not-found',
): string {
  if (error === 'empty-name') return t('view.error.emptyName')
  if (error === 'name-collision') return t('view.error.nameCollision')
  return t('view.error.notFound')
}

function isLiveCatalogItem(
  item: DishCatalogItem,
): item is DishCatalogItem & { kind: 'recipe' | 'simple-food' } {
  return item.kind === 'recipe' || item.kind === 'simple-food'
}

function applyTagsErrorMessage(
  t: Translate,
  error: 'empty-selection' | 'empty-op' | 'empty-name',
): string {
  if (error === 'empty-selection') return t('tags.error.emptySelection')
  if (error === 'empty-name') return t('tags.error.emptyName')
  return t('tags.error.emptyOp')
}

export function RecipesScreen() {
  const recipes = useRecipes()
  const simpleFoods = useSimpleFoods()
  const tags = useTags()
  const ingredients = useIngredients()
  const settings = useSettings()
  const views = useLibraryViews()
  const { settingsRepository, libraryViewService, tagService } = useServices()
  const navigate = useNavigate()
  const formatQty = useFormatQuantity()
  const { t, tPlural } = useLocalization()
  const ingredientLabel = useIngredientLabel()
  const [filters, setFilters] = useState<DishCatalogFilters>(() => ({
    ...defaultDishCatalogFilters('all'),
    ...recipesBrowseState.filters,
  }))
  const [loadedViewId, setLoadedViewId] = useState<LibraryViewId | null>(
    () => recipesBrowseState.loadedViewId,
  )
  const [selecting, setSelecting] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())
  const [visibleItems, setVisibleItems] = useState<
    { key: string; kind: 'recipe' | 'simple-food'; id: string; tagIds: string[] }[]
  >([])
  const [addOpened, setAddOpened] = useState(false)
  const [removeOpened, setRemoveOpened] = useState(false)
  const [addNames, setAddNames] = useState<string[]>([])
  const [removeTagIds, setRemoveTagIds] = useState<string[]>([])

  const sort: CatalogSort = settings?.catalogSort ?? DEFAULT_CATALOG_SORT
  const group: CatalogGroup = settings?.catalogGroup ?? DEFAULT_CATALOG_GROUP

  const setFiltersAndPersist = (next: DishCatalogFilters) => {
    recipesBrowseState.filters = next
    setFilters(next)
  }

  const applyView = (view: LibraryView) => {
    const browse = catalogBrowseFromCriteria(view.criteria)
    recipesBrowseState.filters = browse.filters
    recipesBrowseState.loadedViewId = view.id
    setFilters(browse.filters)
    setLoadedViewId(view.id)
    void settingsRepository.update({
      catalogSort: browse.sort,
      catalogGroup: browse.group,
    })
  }

  const currentCriteria = useMemo(
    () => criteriaFromCatalogBrowse(filters, sort, group),
    [filters, sort, group],
  )

  const loadedView = views?.find((view) => view.id === loadedViewId)
  const dirty = Boolean(
    loadedView && !libraryViewCriteriaEquals(loadedView.criteria, currentCriteria),
  )

  const tagNamesById = useMemo(() => {
    const map = new Map<string, string>()
    for (const tag of tags ?? []) map.set(tag.id, tag.name)
    return map
  }, [tags])
  const archivedTagIds = useMemo(() => archivedTagIdSet(tags ?? []), [tags])
  const tagsById = useMemo(() => {
    const records = new Map<string, { archived?: boolean }>()
    for (const tag of tags ?? []) records.set(tag.id, { archived: tag.archived })
    return records
  }, [tags])
  const knownIngredientIds = useMemo(
    () => new Set((ingredients ?? []).map((ingredient) => ingredient.id)),
    [ingredients],
  )
  const staleRefs = useMemo(
    () => findStaleLibraryViewRefs(currentCriteria, tagsById, knownIngredientIds),
    [currentCriteria, tagsById, knownIngredientIds],
  )
  const { skipTagIds, skipIngredientIds } = useMemo(
    () => skipIdsForMatching(staleRefs),
    [staleRefs],
  )

  const items = useMemo(() => {
    const recipeItems = (recipes ?? []).map((recipe) =>
      recipeToCatalogItem(recipe, tagNamesById, {
        subtitle:
          recipe.totalTimeMinutes !== undefined
            ? t('recipes.yieldEffortTime', {
                yield: formatQty(recipe.yield),
                effort: effortLabel(t, recipe.effort),
                minutes: recipe.totalTimeMinutes,
              })
            : t('recipes.yieldEffort', {
                yield: formatQty(recipe.yield),
                effort: effortLabel(t, recipe.effort),
              }),
      }),
    )
    const foodItems = (simpleFoods ?? []).map((food) =>
      simpleFoodToCatalogItem(food, tagNamesById, {
        subtitle: formatQty(food.defaultPortion),
      }),
    )
    return [...recipeItems, ...foodItems]
  }, [recipes, simpleFoods, formatQty, tagNamesById, t])

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

  useLayoutEffect(() => {
    if (items.length === 0) return
    window.scrollTo(0, recipesBrowseState.scrollY)
    // Restore once, right after the library first has content to scroll into.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length > 0])

  const captureScroll = () => {
    recipesBrowseState.scrollY = window.scrollY
  }

  const selectedItems = useMemo(
    () => items.filter((item) => selectedKeys.has(item.key)),
    [items, selectedKeys],
  )
  const selectedRefs: CatalogTagItemRef[] = useMemo(
    () => selectedItems.filter(isLiveCatalogItem).map((item) => ({ kind: item.kind, id: item.id })),
    [selectedItems],
  )
  const removeOptions = useMemo(() => {
    const ids = new Set<string>()
    for (const item of selectedItems) {
      for (const tagId of item.tagIds) ids.add(tagId)
    }
    return [...ids].map((id) => ({
      value: id,
      label: tagNamesById.get(id) ?? t('common.unavailableTag'),
    }))
  }, [selectedItems, tagNamesById, t])
  const addTagSuggestions = useMemo(() => tagCreateAutocompleteNames(tags ?? []), [tags])

  const handleVisibleItemsChange = useCallback((next: DishCatalogItem[]) => {
    setVisibleItems(
      next.filter(isLiveCatalogItem).map((item) => ({
        key: item.key,
        kind: item.kind,
        id: item.id,
        tagIds: item.tagIds,
      })),
    )
  }, [])

  const exitSelectMode = () => {
    setSelecting(false)
    setSelectedKeys(new Set())
    setAddOpened(false)
    setRemoveOpened(false)
    setAddNames([])
    setRemoveTagIds([])
  }

  const applyBulkTags = (ops: { addNames?: string[]; removeTagIds?: string[] }) => {
    if (selectedRefs.length === 0) {
      notifications.show({ message: applyTagsErrorMessage(t, 'empty-selection'), color: 'red' })
      return
    }
    const addLabel = (ops.addNames ?? []).filter((name) => name.trim()).join(', ')
    const removeLabel = (ops.removeTagIds ?? []).map((id) => tagNamesById.get(id) ?? id).join(', ')
    modals.openConfirmModal({
      title: t('recipes.updateTags'),
      children: (
        <Text size="sm">
          {t('recipes.applyTo', { count: selectedRefs.length })}
          {addLabel ? t('recipes.addClause', { names: addLabel }) : ''}
          {removeLabel ? t('recipes.removeClause', { names: removeLabel }) : ''}.
        </Text>
      ),
      labels: { confirm: t('action.apply'), cancel: t('action.cancel') },
      onConfirm: () => {
        void (async () => {
          const result = await tagService.applyTagsToCatalogItems(selectedRefs, ops)
          if (!result.ok) {
            notifications.show({ message: applyTagsErrorMessage(t, result.error), color: 'red' })
            return
          }
          notifications.show({ message: t('recipes.tagsUpdated'), color: 'green' })
          setAddOpened(false)
          setRemoveOpened(false)
          setAddNames([])
          setRemoveTagIds([])
        })()
      },
    })
  }

  return (
    <Stack gap="lg">
      <PageTitle
        actions={
          <Group gap={8}>
            <ActionIcon
              component={Link}
              to="/recipes/import"
              onClick={captureScroll}
              variant="default"
              radius="xl"
              size={34}
              aria-label={t('recipes.import')}
            >
              <IconFileImport size={18} />
            </ActionIcon>
            <ActionIcon
              component={Link}
              to="/recipes/new"
              onClick={captureScroll}
              variant="default"
              radius="xl"
              size={34}
              aria-label={t('recipes.new')}
            >
              <IconPlus size={18} />
            </ActionIcon>
          </Group>
        }
      >
        {t('recipes.title')}
      </PageTitle>

      <Group gap="xs">
        <ActionIcon
          component={Link}
          to="/recipes/simple-foods"
          onClick={captureScroll}
          variant="light"
          radius="xl"
          size={34}
          aria-label={t('recipes.simpleFoods')}
        >
          <IconApple size={18} />
        </ActionIcon>
        <Text
          component={Link}
          to="/recipes/simple-foods"
          onClick={captureScroll}
          size="sm"
          style={{ textDecoration: 'none' }}
        >
          {t('recipes.manageSimpleFoods')}
        </Text>
        <ActionIcon
          component={Link}
          to="/recipes/ingredients"
          onClick={captureScroll}
          variant="light"
          radius="xl"
          size={34}
          aria-label={t('recipes.ingredients')}
          ml="sm"
        >
          <IconCarrot size={18} />
        </ActionIcon>
        <Text
          component={Link}
          to="/recipes/ingredients"
          onClick={captureScroll}
          size="sm"
          style={{ textDecoration: 'none' }}
        >
          {t('recipes.ingredients')}
        </Text>
        <ActionIcon
          component={Link}
          to="/recipes/tags"
          onClick={captureScroll}
          variant="light"
          radius="xl"
          size={34}
          aria-label={t('recipes.tags')}
          ml="sm"
        >
          <IconTag size={18} />
        </ActionIcon>
        <Text
          component={Link}
          to="/recipes/tags"
          onClick={captureScroll}
          size="sm"
          style={{ textDecoration: 'none' }}
        >
          {t('recipes.tags')}
        </Text>
      </Group>

      {recipes === undefined && <Text c="dimmed">{t('common.loading')}</Text>}
      {recipes?.length === 0 && simpleFoods?.length === 0 && (
        <Stack gap={4}>
          <Text c="dimmed">{t('empty.recipes')}</Text>
          <Text size="sm" c="dimmed">
            {t('empty.recipesHint')}
          </Text>
        </Stack>
      )}

      {(recipes !== undefined || simpleFoods !== undefined) && (
        <Stack gap="xs">
          <LibraryViewsBar
            views={views ?? []}
            loadedViewId={loadedViewId}
            dirty={dirty}
            onSelectView={(id) => {
              if (!id) {
                recipesBrowseState.loadedViewId = null
                setLoadedViewId(null)
                return
              }
              const view = views?.find((candidate) => candidate.id === id)
              if (view) applyView(view)
            }}
            onSaveAsNew={async (name) => {
              const result = await libraryViewService.create(name, currentCriteria)
              if (!result.ok) {
                notifications.show({ message: viewErrorMessage(t, result.error), color: 'red' })
                return false
              }
              recipesBrowseState.loadedViewId = result.view.id
              setLoadedViewId(result.view.id)
              notifications.show({
                message: t('view.saved', { name: result.view.name }),
                color: 'green',
              })
              return true
            }}
            onUpdate={async () => {
              if (!loadedViewId) return false
              const result = await libraryViewService.updateCriteria(loadedViewId, currentCriteria)
              if (!result.ok) {
                notifications.show({ message: viewErrorMessage(t, result.error), color: 'red' })
                return false
              }
              notifications.show({ message: t('view.updated'), color: 'green' })
              return true
            }}
            onRename={async (name) => {
              if (!loadedViewId) return false
              const result = await libraryViewService.rename(loadedViewId, name)
              if (!result.ok) {
                notifications.show({ message: viewErrorMessage(t, result.error), color: 'red' })
                return false
              }
              notifications.show({ message: t('view.renamed'), color: 'green' })
              return true
            }}
            onDelete={async () => {
              if (!loadedViewId) return
              const result = await libraryViewService.delete(loadedViewId)
              if (!result.ok) {
                notifications.show({ message: viewErrorMessage(t, result.error), color: 'red' })
                return
              }
              recipesBrowseState.loadedViewId = null
              setLoadedViewId(null)
              notifications.show({ message: t('view.deleted'), color: 'green' })
            }}
          />
          <Select
            size="xs"
            w={240}
            label={t('cleanup.label')}
            description={t('cleanup.help')}
            placeholder={t('common.none')}
            clearable
            data={LIBRARY_CLEANUP_KINDS.map((kind) => ({
              value: kind,
              label: cleanupLabel(t, kind),
            }))}
            value={filters.cleanup || null}
            onChange={(value) =>
              setFiltersAndPersist({
                ...filters,
                cleanup: (value as LibraryCleanupKind | null) ?? '',
              })
            }
            aria-label={t('cleanup.label')}
          />
        </Stack>
      )}

      {filters.cleanup && items.length > 0 && (
        <Alert color="gray" title={t('cleanup.alertTitle')}>
          {t('cleanup.alertBody')}
        </Alert>
      )}

      {staleRefs.length > 0 && (
        <Alert color="yellow" title={t('catalog.staleFiltersTitle')}>
          {t('catalog.staleFiltersBody')}
        </Alert>
      )}

      {(recipes !== undefined || simpleFoods !== undefined) && items.length > 0 && (
        <Paper withBorder p="sm" radius="md">
          <Group gap="xs" wrap="wrap">
            {selecting ? (
              <Button size="compact-sm" variant="default" onClick={exitSelectMode}>
                {t('recipes.done')}
              </Button>
            ) : (
              <Button size="compact-sm" variant="default" onClick={() => setSelecting(true)}>
                {t('recipes.select')}
              </Button>
            )}
            {selecting && (
              <>
                <Text size="sm">{tPlural('catalog.selected', selectedKeys.size)}</Text>
                <Button
                  size="compact-sm"
                  variant="subtle"
                  disabled={selectedKeys.size === 0}
                  onClick={() => setSelectedKeys(new Set())}
                >
                  {t('recipes.clearSelection')}
                </Button>
                <Button
                  size="compact-sm"
                  variant="subtle"
                  disabled={visibleItems.length === 0}
                  onClick={() => setSelectedKeys(new Set(visibleItems.map((item) => item.key)))}
                >
                  {t('recipes.selectVisible')}
                </Button>
                <Button
                  size="compact-sm"
                  disabled={selectedKeys.size === 0}
                  onClick={() => {
                    setAddNames([])
                    setAddOpened(true)
                  }}
                >
                  {t('recipes.addTags')}
                </Button>
                <Button
                  size="compact-sm"
                  variant="light"
                  disabled={selectedKeys.size === 0 || removeOptions.length === 0}
                  onClick={() => {
                    setRemoveTagIds([])
                    setRemoveOpened(true)
                  }}
                >
                  {t('recipes.removeTag')}
                </Button>
              </>
            )}
          </Group>
        </Paper>
      )}

      {(recipes !== undefined || simpleFoods !== undefined) && items.length > 0 && (
        <DishCatalog
          items={items}
          filters={filters}
          onFiltersChange={setFiltersAndPersist}
          tagNamesById={tagNamesById}
          archivedTagIds={archivedTagIds}
          skipTagIds={skipTagIds}
          skipIngredientIds={skipIngredientIds}
          sort={sort}
          onSortChange={(next) => void settingsRepository.update({ catalogSort: next })}
          group={group}
          onGroupChange={(next) => void settingsRepository.update({ catalogGroup: next })}
          showGroupControl
          layout="page"
          ingredientOptions={ingredientOptions}
          selectionMode={selecting}
          selectedKeys={selectedKeys}
          onToggleSelect={(item) => {
            setSelectedKeys((current) => {
              const next = new Set(current)
              if (next.has(item.key)) next.delete(item.key)
              else next.add(item.key)
              return next
            })
          }}
          onVisibleItemsChange={handleVisibleItemsChange}
          onSelect={(item) => {
            captureScroll()
            if (item.kind === 'simple-food') {
              void navigate(`/recipes/simple-foods/${item.id}`)
              return
            }
            void navigate(`/recipes/${item.id}`)
          }}
        />
      )}

      <Modal
        opened={addOpened}
        onClose={() => setAddOpened(false)}
        title={t('recipes.addTags')}
        centered
      >
        <Stack>
          <TagsInput
            label={t('recipes.tags')}
            data={addTagSuggestions}
            value={addNames}
            onChange={setAddNames}
            placeholder={t('recipes.tagPlaceholder')}
          />
          <Button onClick={() => applyBulkTags({ addNames })}>{t('action.apply')}</Button>
        </Stack>
      </Modal>

      <Modal
        opened={removeOpened}
        onClose={() => setRemoveOpened(false)}
        title={t('recipes.removeTag')}
        centered
      >
        <Stack>
          <MultiSelect
            label={t('recipes.tagsOnSelection')}
            data={removeOptions}
            value={removeTagIds}
            onChange={setRemoveTagIds}
            searchable
          />
          <Button onClick={() => applyBulkTags({ removeTagIds })}>{t('action.apply')}</Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
