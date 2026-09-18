import { ActionIcon, Alert, Group, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconFileImport, IconPlus, IconCarrot, IconApple, IconTag } from '@tabler/icons-react'
import { useLayoutEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useServices } from '../../app/servicesContext'
import {
  DEFAULT_CATALOG_GROUP,
  DEFAULT_CATALOG_SORT,
  EFFORT_LABELS,
  type CatalogGroup,
  type CatalogSort,
} from '../../domain/shared/MealEnums'
import {
  findStaleLibraryViewRefs,
  libraryViewCriteriaEquals,
  skipIdsForMatching,
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
  type IngredientFilterOption,
} from '../catalog/catalogModel'
import { PageTitle } from '../components/ScreenHeader'
import { useIngredients } from '../hooks/useIngredients'
import { useLibraryViews } from '../hooks/useLibraryViews'
import { useRecipes } from '../hooks/useRecipes'
import { useSettings } from '../hooks/useSettings'
import { useSimpleFoods } from '../hooks/useSimpleFoods'
import { useTags } from '../hooks/useTags'
import { archivedTagIdSet } from '../../domain/tags/Tag'
import { useFormatQuantity } from '../localization/useFormatQuantity'
import { useIngredientLabel } from '../localization/useIngredientLabel'
import { useLocalization } from '../localization/LocalizationContext'
import { recipesBrowseState } from './recipesBrowseState'

function viewErrorMessage(error: 'empty-name' | 'name-collision' | 'not-found'): string {
  if (error === 'empty-name') return 'View name cannot be empty'
  if (error === 'name-collision') return 'Another view already has that name'
  return 'Saved view not found'
}

export function RecipesScreen() {
  const recipes = useRecipes()
  const simpleFoods = useSimpleFoods()
  const tags = useTags()
  const ingredients = useIngredients()
  const settings = useSettings()
  const views = useLibraryViews()
  const { settingsRepository, libraryViewService } = useServices()
  const navigate = useNavigate()
  const formatQty = useFormatQuantity()
  const { t } = useLocalization()
  const ingredientLabel = useIngredientLabel()
  const [filters, setFilters] = useState<DishCatalogFilters>(() => ({
    ...defaultDishCatalogFilters('all'),
    ...recipesBrowseState.filters,
  }))
  const [loadedViewId, setLoadedViewId] = useState<LibraryViewId | null>(
    () => recipesBrowseState.loadedViewId,
  )

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
          `Yield ${formatQty(recipe.yield)} · ${EFFORT_LABELS[recipe.effort]}` +
          (recipe.totalTimeMinutes !== undefined ? ` · ${recipe.totalTimeMinutes} min` : ''),
      }),
    )
    const foodItems = (simpleFoods ?? []).map((food) =>
      simpleFoodToCatalogItem(food, tagNamesById, {
        subtitle: formatQty(food.defaultPortion),
      }),
    )
    return [...recipeItems, ...foodItems]
  }, [recipes, simpleFoods, formatQty, tagNamesById])

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
              aria-label="Import recipe"
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
              aria-label="New recipe"
            >
              <IconPlus size={18} />
            </ActionIcon>
          </Group>
        }
      >
        Recipes
      </PageTitle>

      <Group gap="xs">
        <ActionIcon
          component={Link}
          to="/recipes/simple-foods"
          onClick={captureScroll}
          variant="light"
          radius="xl"
          size={34}
          aria-label="Simple foods"
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
          Manage simple foods
        </Text>
        <ActionIcon
          component={Link}
          to="/recipes/ingredients"
          onClick={captureScroll}
          variant="light"
          radius="xl"
          size={34}
          aria-label="Ingredients"
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
          Ingredients
        </Text>
        <ActionIcon
          component={Link}
          to="/recipes/tags"
          onClick={captureScroll}
          variant="light"
          radius="xl"
          size={34}
          aria-label="Tags"
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
          Tags
        </Text>
      </Group>

      {recipes === undefined && <Text c="dimmed">Loading…</Text>}
      {recipes?.length === 0 && simpleFoods?.length === 0 && (
        <Stack gap={4}>
          <Text c="dimmed">{t('empty.recipes')}</Text>
          <Text size="sm" c="dimmed">
            {t('empty.recipesHint')}
          </Text>
        </Stack>
      )}

      {(recipes !== undefined || simpleFoods !== undefined) && (
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
              notifications.show({ message: viewErrorMessage(result.error), color: 'red' })
              return false
            }
            recipesBrowseState.loadedViewId = result.view.id
            setLoadedViewId(result.view.id)
            notifications.show({ message: `Saved “${result.view.name}”`, color: 'green' })
            return true
          }}
          onUpdate={async () => {
            if (!loadedViewId) return false
            const result = await libraryViewService.updateCriteria(loadedViewId, currentCriteria)
            if (!result.ok) {
              notifications.show({ message: viewErrorMessage(result.error), color: 'red' })
              return false
            }
            notifications.show({ message: 'View updated', color: 'green' })
            return true
          }}
          onRename={async (name) => {
            if (!loadedViewId) return false
            const result = await libraryViewService.rename(loadedViewId, name)
            if (!result.ok) {
              notifications.show({ message: viewErrorMessage(result.error), color: 'red' })
              return false
            }
            notifications.show({ message: 'View renamed', color: 'green' })
            return true
          }}
          onDelete={async () => {
            if (!loadedViewId) return
            const result = await libraryViewService.delete(loadedViewId)
            if (!result.ok) {
              notifications.show({ message: viewErrorMessage(result.error), color: 'red' })
              return
            }
            recipesBrowseState.loadedViewId = null
            setLoadedViewId(null)
            notifications.show({ message: 'View deleted', color: 'green' })
          }}
        />
      )}

      {staleRefs.length > 0 && (
        <Alert color="yellow" title="Some filters are no longer in the catalog">
          Archived tags still apply by name. Deleted tags and missing ingredients stay visible as
          chips so you can clear them; they are ignored while matching so this view does not empty
          the library.
        </Alert>
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
    </Stack>
  )
}
