import { ActionIcon, Button, Card, Group, Stack, Switch, Text, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { IconTrash } from '@tabler/icons-react'
import { useServices } from '../../app/servicesContext'
import type { Ingredient } from '../../domain/ingredients/Ingredient'
import { ScreenHeader } from '../components/ScreenHeader'
import { useIngredients } from '../hooks/useIngredients'

interface NewIngredientForm {
  name: string
  aliasesText: string
  category: string
  isCommon: boolean
}

export function IngredientsScreen() {
  const { ingredientService } = useServices()
  const ingredients = useIngredients()

  const form = useForm<NewIngredientForm>({
    initialValues: { name: '', aliasesText: '', category: '', isCommon: false },
    validate: {
      name: (value) => (value.trim().length === 0 ? 'Name is required' : null),
    },
  })

  const handleCreate = form.onSubmit(async (values) => {
    const aliases = values.aliasesText
      .split(',')
      .map((alias) => alias.trim())
      .filter(Boolean)
    const result = await ingredientService.createIngredient({
      name: values.name,
      aliases,
      category: values.category.trim() || undefined,
      isCommon: values.isCommon,
    })
    if (!result.ok) {
      notifications.show({
        message:
          result.error === 'name-collision'
            ? 'An ingredient with that name or alias already exists'
            : 'Name is required',
        color: 'red',
      })
      return
    }
    form.reset()
    notifications.show({ message: 'Ingredient added', color: 'green' })
  })

  const handleDelete = (ingredient: Ingredient) => {
    modals.openConfirmModal({
      title: 'Delete ingredient',
      children: (
        <Text>
          Delete “{ingredient.name}”? Recipes that reference it keep their display text, but the
          catalog link will be missing until you edit them.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const result = await ingredientService.deleteIngredient(ingredient.id)
        if (!result.ok) {
          notifications.show({ message: 'Ingredient not found', color: 'red' })
          return
        }
        notifications.show({ message: 'Ingredient deleted', color: 'green' })
      },
    })
  }

  return (
    <Stack gap="md">
      <ScreenHeader title="Ingredients" fallbackTo="/recipes" />

      <Text size="sm" c="dimmed">
        Canonical names and aliases. Saving a recipe also creates ingredients from typed names.
      </Text>

      <form onSubmit={handleCreate}>
        <Stack gap="sm">
          <TextInput label="Name" required {...form.getInputProps('name')} />
          <TextInput
            label="Aliases"
            description="Comma-separated"
            {...form.getInputProps('aliasesText')}
          />
          <TextInput label="Category" {...form.getInputProps('category')} />
          <Switch
            label="Common pantry item"
            {...form.getInputProps('isCommon', { type: 'checkbox' })}
          />
          <Button type="submit">Add ingredient</Button>
        </Stack>
      </form>

      {ingredients === undefined && <Text c="dimmed">Loading…</Text>}
      {ingredients?.length === 0 && <Text c="dimmed">No ingredients yet.</Text>}

      <Stack gap="xs">
        {ingredients?.map((ingredient) => (
          <Card key={ingredient.id} withBorder padding="sm">
            <Group justify="space-between" align="flex-start">
              <div>
                <Text fw={500}>{ingredient.name}</Text>
                {ingredient.aliases.length > 0 && (
                  <Text size="sm" c="dimmed">
                    Aliases: {ingredient.aliases.join(', ')}
                  </Text>
                )}
                {ingredient.category && (
                  <Text size="sm" c="dimmed">
                    {ingredient.category}
                  </Text>
                )}
                <Switch
                  mt="xs"
                  size="sm"
                  label="Common"
                  checked={ingredient.isCommon}
                  onChange={(event) => {
                    void ingredientService.updateIngredient(ingredient.id, {
                      isCommon: event.currentTarget.checked,
                    })
                  }}
                />
              </div>
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label={`Delete ${ingredient.name}`}
                onClick={() => handleDelete(ingredient)}
              >
                <IconTrash size={18} />
              </ActionIcon>
            </Group>
          </Card>
        ))}
      </Stack>
    </Stack>
  )
}
