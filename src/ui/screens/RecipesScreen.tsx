import { ActionIcon, Group, Stack, Text } from '@mantine/core'
import { IconFileImport, IconPlus, IconCarrot, IconApple } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { EFFORT_LABELS } from '../../domain/shared/MealEnums'
import { DishCatalog } from '../catalog/DishCatalog'
import {
  defaultDishCatalogFilters,
  recipeToCatalogItem,
  simpleFoodToCatalogItem,
  type DishCatalogFilters,
} from '../catalog/catalogModel'
import { PageTitle } from '../components/ScreenHeader'
import { useRecipes } from '../hooks/useRecipes'
import { useSimpleFoods } from '../hooks/useSimpleFoods'
import { useFormatQuantity } from '../localization/useFormatQuantity'
import { useLocalization } from '../localization/LocalizationContext'

export function RecipesScreen() {
  const recipes = useRecipes()
  const simpleFoods = useSimpleFoods()
  const navigate = useNavigate()
  const formatQty = useFormatQuantity()
  const { t } = useLocalization()
  const [filters, setFilters] = useState<DishCatalogFilters>(() => defaultDishCatalogFilters('all'))

  const items = useMemo(() => {
    const recipeItems = (recipes ?? []).map((recipe) =>
      recipeToCatalogItem(recipe, {
        subtitle: `Recipe · Yield ${formatQty(recipe.yield)} · ${EFFORT_LABELS[recipe.effort]}`,
      }),
    )
    const foodItems = (simpleFoods ?? []).map((food) =>
      simpleFoodToCatalogItem(food, {
        subtitle: `Simple food · ${formatQty(food.defaultPortion)}`,
      }),
    )
    return [...recipeItems, ...foodItems]
  }, [recipes, simpleFoods, formatQty])

  return (
    <Stack gap="lg">
      <PageTitle
        actions={
          <Group gap={8}>
            <ActionIcon
              component={Link}
              to="/recipes/import"
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
          size="sm"
          style={{ textDecoration: 'none' }}
        >
          Manage simple foods
        </Text>
        <ActionIcon
          component={Link}
          to="/recipes/ingredients"
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
          size="sm"
          style={{ textDecoration: 'none' }}
        >
          Ingredients
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
          onFiltersChange={setFilters}
          layout="page"
          onSelect={(item) => {
            if (item.kind === 'simple-food') {
              void navigate('/recipes/simple-foods')
              return
            }
            void navigate(`/recipes/${item.id}`)
          }}
        />
      )}
    </Stack>
  )
}
