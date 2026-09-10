import { ActionIcon, Badge, Card, Group, Stack, Text } from '@mantine/core'
import { IconFileImport, IconPlus, IconCarrot, IconApple } from '@tabler/icons-react'
import { Link } from 'react-router'
import { useRecipes } from '../hooks/useRecipes'
import { formatQuantity } from '../../domain/shared/formatQuantity'
import { EFFORT_LABELS, RECIPE_ROLE_LABELS } from '../../domain/shared/MealEnums'
import { PageTitle } from '../components/ScreenHeader'

export function RecipesScreen() {
  const recipes = useRecipes()

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
          Simple foods
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
      {recipes?.length === 0 && <Text c="dimmed">No recipes yet.</Text>}

      <Stack gap={12}>
        {recipes?.map((recipe) => (
          <Card
            key={recipe.id}
            padding={12}
            radius="md"
            withBorder
            component={Link}
            to={`/recipes/${recipe.id}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <Text fw={600} size="sm">
              {recipe.name}
            </Text>
            <Text size="xs" c="dimmed" mt={2}>
              Yield {formatQuantity(recipe.yield)} · {EFFORT_LABELS[recipe.effort]}
            </Text>
            <Group gap={4} mt={8}>
              {recipe.roles.map((role) => (
                <Badge key={role} size="sm" variant="light" radius="xl">
                  {RECIPE_ROLE_LABELS[role]}
                </Badge>
              ))}
            </Group>
          </Card>
        ))}
      </Stack>
    </Stack>
  )
}
