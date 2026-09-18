import {
  ActionIcon,
  Alert,
  Button,
  Divider,
  Group,
  Menu,
  Modal,
  MultiSelect,
  Paper,
  Stack,
  TagsInput,
  Text,
  UnstyledButton,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import {
  AppleLogo,
  ArrowsDownUp,
  CaretDown,
  Carrot,
  Check,
  CheckSquare,
  Plus,
  Sliders,
  Sparkle,
  Tag,
  UploadSimple,
} from '@phosphor-icons/react'
import { type ReactNode, useCallback, useLayoutEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useServices } from '../../app/servicesContext'
import {
  CATALOG_GROUPS,
  CATALOG_SORTS,
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
  type LibraryView,
  type LibraryViewId,
} from '../../domain/libraryViews/LibraryView'
import { DishCatalog } from '../catalog/DishCatalog'
import { LibraryViewsBar } from '../catalog/LibraryViewsBar'
import {
  catalogActiveFilterCount,
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
import {
  catalogGroupLabel,
  catalogSortLabel,
  cleanupLabel,
  effortLabel,
} from '../localization/labels'
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

function visibleCatalogRowsEqual(
  current: { key: string; kind: 'recipe' | 'simple-food'; id: string; tagIds: string[] }[],
  next: { key: string; kind: 'recipe' | 'simple-food'; id: string; tagIds: string[] }[],
): boolean {
  if (current.length !== next.length) return false
  return current.every((row, index) => {
    const other = next[index]
    return (
      row.key === other.key &&
      row.kind === other.kind &&
      row.id === other.id &&
      row.tagIds.length === other.tagIds.length &&
      row.tagIds.every((tagId, tagIndex) => tagId === other.tagIds[tagIndex])
    )
  })
}

function CatalogManageLink({
  to,
  icon,
  children,
  onClick,
}: {
  to: string
  icon: ReactNode
  children: ReactNode
  onClick: () => void
}) {
  return (
    <UnstyledButton
      component={Link}
      to={to}
      onClick={onClick}
      style={{ color: 'var(--mantine-color-dimmed)' }}
    >
      <Group gap={6} wrap="nowrap">
        {icon}
        <Text size="sm">{children}</Text>
      </Group>
    </UnstyledButton>
  )
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
  const [filterDrawerOpened, setFilterDrawerOpened] = useState(false)

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
    const mapped = next.filter(isLiveCatalogItem).map((item) => ({
      key: item.key,
      kind: item.kind,
      id: item.id,
      tagIds: item.tagIds,
    }))
    setVisibleItems((current) => (visibleCatalogRowsEqual(current, mapped) ? current : mapped))
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
      notifications.show({ message: applyTagsErrorMessage(t, 'empty-selection'), color: 'error' })
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
            notifications.show({ message: applyTagsErrorMessage(t, result.error), color: 'error' })
            return
          }
          notifications.show({ message: t('recipes.tagsUpdated'), color: 'success' })
          setAddOpened(false)
          setRemoveOpened(false)
          setAddNames([])
          setRemoveTagIds([])
        })()
      },
    })
  }

  const extraFilters = catalogActiveFilterCount(filters, false)
  const catalogReady = recipes !== undefined || simpleFoods !== undefined
  const itemCount = (recipes?.length ?? 0) + (simpleFoods?.length ?? 0)

  const viewsBar = (
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
          notifications.show({ message: viewErrorMessage(t, result.error), color: 'error' })
          return false
        }
        recipesBrowseState.loadedViewId = result.view.id
        setLoadedViewId(result.view.id)
        notifications.show({
          message: t('view.saved', { name: result.view.name }),
          color: 'success',
        })
        return true
      }}
      onUpdate={async () => {
        if (!loadedViewId) return false
        const result = await libraryViewService.updateCriteria(loadedViewId, currentCriteria)
        if (!result.ok) {
          notifications.show({ message: viewErrorMessage(t, result.error), color: 'error' })
          return false
        }
        notifications.show({ message: t('view.updated'), color: 'success' })
        return true
      }}
      onRename={async (name) => {
        if (!loadedViewId) return false
        const result = await libraryViewService.rename(loadedViewId, name)
        if (!result.ok) {
          notifications.show({ message: viewErrorMessage(t, result.error), color: 'error' })
          return false
        }
        notifications.show({ message: t('view.renamed'), color: 'success' })
        return true
      }}
      onDelete={async () => {
        if (!loadedViewId) return
        const result = await libraryViewService.delete(loadedViewId)
        if (!result.ok) {
          notifications.show({ message: viewErrorMessage(t, result.error), color: 'error' })
          return
        }
        recipesBrowseState.loadedViewId = null
        setLoadedViewId(null)
        notifications.show({ message: t('view.deleted'), color: 'success' })
      }}
    />
  )

  const browseToolbar = (
    <Group gap="xs" justify="space-between" wrap="wrap" align="center">
      <Group gap="xs" wrap="wrap">
        {viewsBar}
        <Menu shadow="md" width={260} position="bottom-start">
          <Menu.Target>
            <Button
              type="button"
              size="compact-sm"
              variant="default"
              radius="md"
              leftSection={<Sparkle size={14} />}
              rightSection={<CaretDown size={12} />}
              aria-label={t('cleanup.findGaps')}
            >
              {filters.cleanup ? cleanupLabel(t, filters.cleanup) : t('cleanup.findGaps')}
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              onClick={() => setFiltersAndPersist({ ...filters, cleanup: '' })}
              leftSection={!filters.cleanup ? <Check size={14} /> : undefined}
            >
              {t('common.none')}
            </Menu.Item>
            <Menu.Divider />
            {LIBRARY_CLEANUP_KINDS.map((kind) => (
              <Menu.Item
                key={kind}
                onClick={() => setFiltersAndPersist({ ...filters, cleanup: kind })}
                leftSection={filters.cleanup === kind ? <Check size={14} /> : undefined}
              >
                {cleanupLabel(t, kind)}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </Group>
      <Group gap="xs" wrap="nowrap">
        <Menu shadow="md" width={220} position="bottom-end">
          <Menu.Target>
            <Button
              type="button"
              size="compact-sm"
              variant="default"
              radius="md"
              leftSection={<ArrowsDownUp size={14} />}
              rightSection={<CaretDown size={12} />}
              aria-label={t('catalog.sortBy')}
            >
              {catalogSortLabel(t, sort)}
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>{t('catalog.sortBy')}</Menu.Label>
            {CATALOG_SORTS.map((value) => (
              <Menu.Item
                key={value}
                onClick={() => void settingsRepository.update({ catalogSort: value })}
                leftSection={sort === value ? <Check size={14} /> : undefined}
              >
                {catalogSortLabel(t, value)}
              </Menu.Item>
            ))}
            <Menu.Divider />
            <Menu.Label>{t('catalog.groupBy')}</Menu.Label>
            {CATALOG_GROUPS.map((value) => (
              <Menu.Item
                key={value}
                onClick={() => void settingsRepository.update({ catalogGroup: value })}
                leftSection={group === value ? <Check size={14} /> : undefined}
              >
                {catalogGroupLabel(t, value)}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
        <Button
          type="button"
          size="compact-sm"
          variant="default"
          radius="md"
          leftSection={<Sliders size={14} />}
          onClick={() => setFilterDrawerOpened(true)}
        >
          {extraFilters > 0
            ? t('catalog.filtersCount', { count: extraFilters })
            : t('catalog.filters')}
        </Button>
        <Divider orientation="vertical" />
        <Button
          type="button"
          size="compact-sm"
          variant="default"
          radius="md"
          leftSection={<CheckSquare size={14} />}
          onClick={() => setSelecting(true)}
        >
          {t('recipes.select')}
        </Button>
      </Group>
    </Group>
  )

  const selectionToolbar = (
    <Group gap="xs" wrap="wrap">
      <Button size="compact-sm" variant="default" onClick={exitSelectMode}>
        {t('recipes.done')}
      </Button>
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
    </Group>
  )

  return (
    <Stack gap="lg">
      <PageTitle
        subtitle={catalogReady ? tPlural('catalog.itemCount', itemCount) : undefined}
        actions={
          <Group gap={8} wrap="nowrap">
            <ActionIcon
              component={Link}
              to="/recipes/import"
              onClick={captureScroll}
              variant="default"
              radius="md"
              size={36}
              aria-label={t('recipes.import')}
            >
              <UploadSimple size={18} />
            </ActionIcon>
            <Button
              component={Link}
              to="/recipes/new"
              onClick={captureScroll}
              leftSection={<Plus size={16} />}
              radius="md"
            >
              {t('recipes.new')}
            </Button>
          </Group>
        }
      >
        {t('recipes.title')}
      </PageTitle>

      <Group gap="lg">
        <CatalogManageLink
          to="/recipes/simple-foods"
          icon={<AppleLogo size={16} />}
          onClick={captureScroll}
        >
          {t('recipes.simpleFoods')}
        </CatalogManageLink>
        <CatalogManageLink
          to="/recipes/ingredients"
          icon={<Carrot size={16} />}
          onClick={captureScroll}
        >
          {t('recipes.ingredients')}
        </CatalogManageLink>
        <CatalogManageLink to="/recipes/tags" icon={<Tag size={16} />} onClick={captureScroll}>
          {t('recipes.tags')}
        </CatalogManageLink>
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

      {catalogReady && items.length > 0 && (
        <Paper withBorder p="sm" radius="lg">
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
            hideSortGroup
            showFiltersButton={false}
            filterDrawerOpened={filterDrawerOpened}
            onFilterDrawerOpenedChange={setFilterDrawerOpened}
            toolbar={selecting ? selectionToolbar : browseToolbar}
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
        </Paper>
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
