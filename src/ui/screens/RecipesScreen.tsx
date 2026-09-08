import { Title, Text, Stack, Card, Group, TextInput, Button } from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { useServices } from '../../app/servicesContext'
import { useRecipes } from '../hooks/useRecipes'

interface NewRecipeForm {
  name: string
}

export function RecipesScreen() {
  const { recipeService } = useServices()
  const recipes = useRecipes()

  const form = useForm<NewRecipeForm>({
    initialValues: { name: '' },
    validate: {
      name: (value) => (value.trim().length === 0 ? 'Name is required' : null),
    },
  })

  const handleSubmit = form.onSubmit(async (values) => {
    await recipeService.createRecipe({ name: values.name.trim(), servings: 2 })
    form.reset()
    notifications.show({ message: 'Recipe added', color: 'green' })
  })

  return (
    <Stack gap="md">
      <Title order={2}>Recipes</Title>

      <form onSubmit={handleSubmit}>
        <Group align="flex-end">
          <TextInput
            flex={1}
            label="New recipe"
            placeholder="e.g. Weeknight pasta"
            {...form.getInputProps('name')}
          />
          <Button type="submit">Add</Button>
        </Group>
      </form>

      {recipes === undefined && <Text c="dimmed">Loading…</Text>}
      {recipes?.length === 0 && <Text c="dimmed">No recipes yet.</Text>}

      <Stack gap="xs">
        {recipes?.map((recipe) => (
          <Card key={recipe.id} withBorder padding="sm">
            <Text fw={500}>{recipe.name}</Text>
          </Card>
        ))}
      </Stack>
    </Stack>
  )
}
