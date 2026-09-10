import {
  ActionIcon,
  Button,
  Card,
  Group,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { IconTrash } from '@tabler/icons-react'
import { useServices } from '../../app/servicesContext'
import type { SimpleFood } from '../../domain/simpleFoods/SimpleFood'
import { QuantityFields } from '../components/QuantityFields'
import { ScreenHeader } from '../components/ScreenHeader'
import { useSimpleFoods } from '../hooks/useSimpleFoods'
import { useFormatQuantity } from '../localization/useFormatQuantity'

interface NewSimpleFoodForm {
  name: string
  portionValue: number | ''
  portionUnit: string
  enabledInSuggestions: boolean
}

export function SimpleFoodsScreen() {
  const { simpleFoodService, ingredientService } = useServices()
  const simpleFoods = useSimpleFoods()
  const formatQty = useFormatQuantity()

  const form = useForm<NewSimpleFoodForm>({
    initialValues: {
      name: '',
      portionValue: 1,
      portionUnit: 'serving',
      enabledInSuggestions: true,
    },
    validate: {
      name: (value) => (value.trim().length === 0 ? 'Name is required' : null),
      portionValue: (value) => (value === '' || value <= 0 ? 'Portion must be positive' : null),
    },
  })

  const handleCreate = form.onSubmit(async (values) => {
    const linked = await ingredientService.createOrLinkByName(values.name)
    if (!linked.ok) {
      notifications.show({ message: 'Name is required', color: 'red' })
      return
    }

    const result = await simpleFoodService.createSimpleFood({
      ingredientId: linked.ingredient.id,
      name: values.name.trim(),
      defaultPortion: {
        value: values.portionValue as number,
        unit: values.portionUnit,
      },
      roles: ['complete'],
      mealTypes: ['breakfast'],
      enabledInSuggestions: values.enabledInSuggestions,
    })

    if (!result.ok) {
      notifications.show({
        message: `Could not create simple food (${result.error})`,
        color: 'red',
      })
      return
    }

    form.reset()
    notifications.show({ message: 'Simple food added', color: 'green' })
  })

  const handleDelete = (simpleFood: SimpleFood) => {
    modals.openConfirmModal({
      title: 'Delete simple food',
      children: (
        <Text>
          Delete “{simpleFood.name}” as a standalone suggestion? The underlying ingredient stays in
          the catalog.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const result = await simpleFoodService.deleteSimpleFood(simpleFood.id)
        if (!result.ok) {
          notifications.show({ message: 'Simple food not found', color: 'red' })
          return
        }
        notifications.show({ message: 'Simple food deleted', color: 'green' })
      },
    })
  }

  return (
    <Stack gap="md">
      <ScreenHeader title="Simple foods" fallbackTo="/recipes" />

      <Text size="sm" c="dimmed">
        Foods served without a recipe (bread, yogurt, banana). Disable to stop suggesting them on
        their own — they remain available as recipe ingredients.
      </Text>

      <form onSubmit={handleCreate}>
        <Stack gap="sm">
          <TextInput
            label="Name"
            placeholder="e.g. yogurt"
            required
            {...form.getInputProps('name')}
          />
          <QuantityFields
            valueLabel="Default portion"
            value={form.values.portionValue}
            unit={form.values.portionUnit}
            min={0.001}
            onValueChange={(value) => form.setFieldValue('portionValue', value)}
            onUnitChange={(unit) => form.setFieldValue('portionUnit', unit)}
          />
          <Switch
            label="Include in meal suggestions"
            {...form.getInputProps('enabledInSuggestions', { type: 'checkbox' })}
          />
          <Button type="submit">Add simple food</Button>
        </Stack>
      </form>

      <Title order={4}>Include in meal suggestions</Title>

      {simpleFoods === undefined && <Text c="dimmed">Loading…</Text>}
      {simpleFoods?.length === 0 && <Text c="dimmed">No simple foods yet.</Text>}

      <Stack gap="xs">
        {simpleFoods?.map((simpleFood) => (
          <Card key={simpleFood.id} withBorder padding="sm">
            <Group justify="space-between" align="flex-start">
              <div>
                <Text fw={500}>{simpleFood.name}</Text>
                <Text size="sm" c="dimmed">
                  Default {formatQty(simpleFood.defaultPortion)}
                </Text>
                <Switch
                  mt="xs"
                  label="Include in suggestions"
                  checked={simpleFood.enabledInSuggestions}
                  onChange={(event) => {
                    void simpleFoodService.setEnabledInSuggestions(
                      simpleFood.id,
                      event.currentTarget.checked,
                    )
                  }}
                />
              </div>
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label={`Delete ${simpleFood.name}`}
                onClick={() => handleDelete(simpleFood)}
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
