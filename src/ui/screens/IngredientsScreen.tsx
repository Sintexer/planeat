import {
  ActionIcon,
  Button,
  Card,
  Collapse,
  Group,
  Stack,
  Switch,
  TagsInput,
  Text,
  TextInput,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { IconChevronDown, IconChevronUp, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { useServices } from '../../app/servicesContext'
import type { Ingredient } from '../../domain/ingredients/Ingredient'
import { UI_LOCALES } from '../../domain/shared/Locale'
import { ScreenHeader } from '../components/ScreenHeader'
import { ShoppingSectionSelect } from '../components/ShoppingSectionSelect'
import { useIngredients } from '../hooks/useIngredients'
import { useIngredientLabel } from '../localization/useIngredientLabel'
import { useLocalization } from '../localization/LocalizationContext'

interface NewIngredientForm {
  name: string
  aliases: string[]
  category: string
  shoppingSection: string
  isCommon: boolean
}

function IngredientEditSection({ ingredient }: { ingredient: Ingredient }) {
  const { ingredientService } = useServices()
  const { t } = useLocalization()

  return (
    <Stack gap="xs" mt="xs">
      {UI_LOCALES.map((locale) => {
        const preferredLabel =
          ingredient.preferredLabels?.find((entry) => entry.locale === locale)?.label ?? ''
        const localizedAliases = (ingredient.localizedAliases ?? [])
          .filter((alias) => alias.locale === locale)
          .map((alias) => alias.text)

        return (
          <Stack key={locale} gap={4}>
            <TextInput
              size="xs"
              label={t('ingredients.preferredLabel', { locale })}
              placeholder={t('ingredients.defaultName')}
              defaultValue={preferredLabel}
              onBlur={(event) => {
                const label = event.currentTarget.value.trim()
                const otherLabels = (ingredient.preferredLabels ?? []).filter(
                  (entry) => entry.locale !== locale,
                )
                void ingredientService.updateIngredient(ingredient.id, {
                  preferredLabels: label ? [...otherLabels, { locale, label }] : otherLabels,
                })
              }}
            />
            <TagsInput
              size="xs"
              label={t('ingredients.aliasesLocale', { locale })}
              value={localizedAliases}
              onChange={(texts) => {
                const otherAliases = (ingredient.localizedAliases ?? []).filter(
                  (alias) => alias.locale !== locale,
                )
                void ingredientService.updateIngredient(ingredient.id, {
                  localizedAliases: [...otherAliases, ...texts.map((text) => ({ locale, text }))],
                })
              }}
            />
          </Stack>
        )
      })}
    </Stack>
  )
}

export function IngredientsScreen() {
  const { ingredientService } = useServices()
  const ingredients = useIngredients()
  const { t } = useLocalization()
  const ingredientLabel = useIngredientLabel()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const form = useForm<NewIngredientForm>({
    initialValues: { name: '', aliases: [], category: '', shoppingSection: '', isCommon: false },
    validate: {
      name: (value) => (value.trim().length === 0 ? t('validation.nameRequired') : null),
    },
  })

  const handleCreate = form.onSubmit(async (values) => {
    const result = await ingredientService.createIngredient({
      name: values.name,
      aliases: values.aliases,
      category: values.category.trim() || undefined,
      shoppingSection: values.shoppingSection || undefined,
      isCommon: values.isCommon,
    })
    if (!result.ok) {
      notifications.show({
        message:
          result.error === 'name-collision'
            ? t('ingredients.nameCollision')
            : t('validation.nameRequired'),
        color: 'red',
      })
      return
    }
    form.reset()
    notifications.show({ message: t('ingredients.added'), color: 'green' })
  })

  const handleDelete = (ingredient: Ingredient) => {
    modals.openConfirmModal({
      title: t('ingredients.deleteTitle'),
      children: <Text>{t('ingredients.deleteBody', { name: ingredient.name })}</Text>,
      labels: { confirm: t('action.delete'), cancel: t('action.cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const result = await ingredientService.deleteIngredient(ingredient.id)
        if (!result.ok) {
          notifications.show({ message: t('ingredients.notFound'), color: 'red' })
          return
        }
        notifications.show({ message: t('ingredients.deleted'), color: 'green' })
      },
    })
  }

  return (
    <Stack gap="md">
      <ScreenHeader title={t('ingredients.title')} fallbackTo="/recipes" />

      <Text size="sm" c="dimmed">
        {t('ingredients.helpShort')}
      </Text>

      <form onSubmit={handleCreate}>
        <Stack gap="sm">
          <TextInput label={t('common.name')} required {...form.getInputProps('name')} />
          <TagsInput label={t('ingredients.aliases')} {...form.getInputProps('aliases')} />
          <TextInput label={t('ingredients.category')} {...form.getInputProps('category')} />
          <ShoppingSectionSelect
            value={form.values.shoppingSection || undefined}
            onChange={(section) => form.setFieldValue('shoppingSection', section ?? '')}
          />
          <Switch
            label={t('ingredient.usuallyAtHome')}
            {...form.getInputProps('isCommon', { type: 'checkbox' })}
          />
          <Button type="submit">{t('ingredients.add')}</Button>
        </Stack>
      </form>

      {ingredients === undefined && <Text c="dimmed">{t('common.loading')}</Text>}
      {ingredients?.length === 0 && <Text c="dimmed">{t('ingredients.empty')}</Text>}

      <Stack gap="xs">
        {ingredients?.map((ingredient) => {
          const expanded = expandedId === ingredient.id
          return (
            <Card key={ingredient.id} withBorder padding="sm">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text fw={500}>{ingredientLabel(ingredient)}</Text>
                  {ingredient.aliases.length > 0 && (
                    <Text size="sm" c="dimmed">
                      {t('ingredients.aliasesList', { list: ingredient.aliases.join(', ') })}
                    </Text>
                  )}
                  {ingredient.category && (
                    <Text size="sm" c="dimmed">
                      {ingredient.category}
                    </Text>
                  )}
                  <ShoppingSectionSelect
                    size="xs"
                    value={ingredient.shoppingSection}
                    onChange={(section) => {
                      void ingredientService.updateIngredient(ingredient.id, {
                        shoppingSection: section,
                      })
                    }}
                  />
                  <Switch
                    mt="xs"
                    size="sm"
                    label={t('ingredient.usuallyAtHomeShort')}
                    checked={ingredient.isCommon}
                    onChange={(event) => {
                      void ingredientService.updateIngredient(ingredient.id, {
                        isCommon: event.currentTarget.checked,
                      })
                    }}
                  />
                </div>
                <Group gap={4}>
                  <ActionIcon
                    variant="subtle"
                    aria-label={
                      expanded
                        ? t('ingredients.collapse')
                        : t('ingredients.editNamed', { name: ingredient.name })
                    }
                    onClick={() => setExpandedId(expanded ? null : ingredient.id)}
                  >
                    {expanded ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label={t('ingredients.deleteNamed', { name: ingredient.name })}
                    onClick={() => handleDelete(ingredient)}
                  >
                    <IconTrash size={18} />
                  </ActionIcon>
                </Group>
              </Group>
              <Collapse expanded={expanded}>
                <IngredientEditSection ingredient={ingredient} />
              </Collapse>
            </Card>
          )
        })}
      </Stack>
    </Stack>
  )
}
