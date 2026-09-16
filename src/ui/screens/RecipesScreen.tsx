import { ActionIcon, Group, Stack, Text } from '@mantine/core'
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
import { DishCatalog } from '../catalog/DishCatalog'
import {
  recipeToCatalogItem,
  simpleFoodToCatalogItem,
  type DishCatalogFilters,
} from '../catalog/catalogModel'
import { PageTitle } from '../components/ScreenHeader'
import { useRecipes } from '../hooks/useRecipes'
import { useSettings } from '../hooks/useSettings'
import { useSimpleFoods } from '../hooks/useSimpleFoods'
import { useTags } from '../hooks/useTags'
import { useFormatQuantity } from '../localization/useFormatQuantity'
import { useLocalization } from '../localization/LocalizationContext'
import { recipesBrowseState } from './recipesBrowseState'

export function RecipesScreen() {
  const recipes = useRecipes()
  const simpleFoods = useSimpleFoods()
  const tags = useTags()
  const settings = useSettings()
  const { settingsRepository } = useServices()
  const navigate = useNavigate()
  const formatQty = useFormatQuantity()
  const { t } = useLocalization()
  const [filters, setFilters] = useState<DishCatalogFilters>(() => recipesBrowseState.filters)

  const sort: CatalogSort = settings?.catalogSort ?? DEFAULT_CATALOG_SORT
  const group: CatalogGroup = settings?.catalogGroup ?? DEFAULT_CATALOG_GROUP

  const setFiltersAndPersist = (next: DishCatalogFilters) => {
    recipesBrowseState.filters = next
    setFilters(next)
  }

  const tagNamesById = useMemo(() => {
    const map = new Map<string, string>()
    for (const tag of tags ?? []) map.set(tag.id, tag.name)
    return map
  }, [tags])

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

  useLayoutEffect(() => {
    if (items.length === 0) return
    window.scrollTo(0, recipesBrowseState.scrollY)
    // Restore once, right after the library first has content to scroll into.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length > 0])

  // Capture the scroll position at the moment of navigating away, not via an unmount
  // effect or a continuous scroll listener: React unmounts this screen and mounts the
  // destination screen in the same commit, so by the time any effect cleanup runs, the
  // DOM (and window.scrollY) already reflects the new, usually-shorter page. Reading it
  // here, before navigate() is even called, is the only point where it's still correct.
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

      {(recipes !== undefined || simpleFoods !== undefined) && items.length > 0 && (
        <DishCatalog
          items={items}
          filters={filters}
          onFiltersChange={setFiltersAndPersist}
          tagNamesById={tagNamesById}
          sort={sort}
          onSortChange={(next) => void settingsRepository.update({ catalogSort: next })}
          group={group}
          onGroupChange={(next) => void settingsRepository.update({ catalogGroup: next })}
          showGroupControl
          layout="page"
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
