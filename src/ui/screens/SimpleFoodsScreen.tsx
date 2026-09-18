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
import { resolveIngredientLabel } from '../../domain/ingredients/Ingredient'
import type { SimpleFood } from '../../domain/simpleFoods/SimpleFood'
import { linkOrCreateIngredient } from '../components/IngredientCandidateModal'
import { QuantityFields } from '../components/QuantityFields'
import { ScreenHeader } from '../components/ScreenHeader'
import { useSimpleFoods } from '../hooks/useSimpleFoods'
import { useFormatQuantity } from '../localization/useFormatQuantity'
import { useLocalization } from '../localization/LocalizationContext'

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
  const { locale, t } = useLocalization()

  const form = useForm<NewSimpleFoodForm>({
    initialValues: {
      name: '',
      portionValue: 1,
      portionUnit: 'serving',
      enabledInSuggestions: true,
    },
    validate: {
      name: (value) => (value.trim().length === 0 ? t('validation.nameRequired') : null),
      portionValue: (value) =>
        value === '' || value <= 0 ? t('validation.portionPositive') : null,
    },
  })

  const handleCreate = form.onSubmit(async (values) => {
    const ingredient = await linkOrCreateIngredient(
      ingredientService,
      values.name,
      (candidate) => resolveIngredientLabel(candidate, locale),
      t,
    )
    if (!ingredient) {
      notifications.show({ message: t('editor.resolveNameFailed'), color: 'red' })
      return
    }

    const result = await simpleFoodService.createSimpleFood({
      ingredientId: ingredient.id,
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
        message: t('foods.createFailed', { error: result.error }),
        color: 'red',
      })
      return
    }

    form.reset()
    notifications.show({ message: t('foods.added'), color: 'green' })
  })

  const handleDelete = (simpleFood: SimpleFood) => {
    modals.openConfirmModal({
      title: t('foods.deleteTitle'),
      children: <Text>{t('foods.deleteBodyLong', { name: simpleFood.name })}</Text>,
      labels: { confirm: t('action.delete'), cancel: t('action.cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const result = await simpleFoodService.deleteSimpleFood(simpleFood.id)
        if (!result.ok) {
          notifications.show({ message: t('foods.notFound'), color: 'red' })
          return
        }
        notifications.show({ message: t('foods.deleted'), color: 'green' })
      },
    })
  }

  return (
    <Stack gap="md">
      <ScreenHeader title={t('foods.title')} fallbackTo="/recipes" />

      <Text size="sm" c="dimmed">
        {t('foods.helpLong')}
      </Text>

      <form onSubmit={handleCreate}>
        <Stack gap="sm">
          <TextInput
            label={t('common.name')}
            placeholder={t('foods.namePlaceholder')}
            required
            {...form.getInputProps('name')}
          />
          <QuantityFields
            valueLabel={t('foods.defaultPortion')}
            value={form.values.portionValue}
            unit={form.values.portionUnit}
            min={0.001}
            onValueChange={(value) => form.setFieldValue('portionValue', value)}
            onUnitChange={(unit) => form.setFieldValue('portionUnit', unit)}
          />
          <Switch
            label={t('foods.includeSuggestions')}
            {...form.getInputProps('enabledInSuggestions', { type: 'checkbox' })}
          />
          <Button type="submit">{t('foods.add')}</Button>
        </Stack>
      </form>

      <Title order={4}>{t('foods.includeSuggestions')}</Title>

      {simpleFoods === undefined && <Text c="dimmed">{t('common.loading')}</Text>}
      {simpleFoods?.length === 0 && <Text c="dimmed">{t('foods.empty')}</Text>}

      <Stack gap="xs">
        {simpleFoods?.map((simpleFood) => (
          <Card key={simpleFood.id} withBorder padding="sm">
            <Group justify="space-between" align="flex-start">
              <div>
                <Text fw={500}>{simpleFood.name}</Text>
                <Text size="sm" c="dimmed">
                  {t('foods.defaultQty', { quantity: formatQty(simpleFood.defaultPortion) })}
                </Text>
                <Switch
                  mt="xs"
                  label={t('foods.includeInSuggestions')}
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
                aria-label={t('foods.deleteNamed', { name: simpleFood.name })}
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
