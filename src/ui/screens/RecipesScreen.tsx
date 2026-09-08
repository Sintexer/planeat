import { Badge, Button, Card, Group, Stack, Text, Title } from '@mantine/core'
import { Link } from 'react-router'
import { useRecipes } from '../hooks/useRecipes'
import { formatQuantity } from '../../domain/shared/formatQuantity'
import { EFFORT_LABELS, RECIPE_ROLE_LABELS } from '../../domain/shared/MealEnums'

export function RecipesScreen() {
  const recipes = useRecipes()

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Title order={2}>Recipes</Title>
        <Button component={Link} to="/recipes/new">
          New recipe
        </Button>
      </Group>

      <Group gap="xs">
        <Button component={Link} to="/recipes/simple-foods" variant="light" size="compact-sm">
          Simple foods
        </Button>
        <Button component={Link} to="/recipes/ingredients" variant="light" size="compact-sm">
          Ingredients
        </Button>
      </Group>

      {recipes === undefined && <Text c="dimmed">Loading…</Text>}
      {recipes?.length === 0 && <Text c="dimmed">No recipes yet.</Text>}

      <Stack gap="xs">
        {recipes?.map((recipe) => (
          <Card
            key={recipe.id}
            withBorder
            padding="sm"
            component={Link}
            to={`/recipes/${recipe.id}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <Text fw={500}>{recipe.name}</Text>
            <Text size="sm" c="dimmed">
              Yield {formatQuantity(recipe.yield)} · {EFFORT_LABELS[recipe.effort]}
            </Text>
            <Group gap={4} mt={6}>
              {recipe.roles.map((role) => (
                <Badge key={role} size="sm" variant="light">
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
