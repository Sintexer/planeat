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
              label={`Preferred label (${locale})`}
              placeholder="Use default name"
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
              label={`Aliases (${locale})`}
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
      name: (value) => (value.trim().length === 0 ? 'Name is required' : null),
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
          <TagsInput label="Aliases" {...form.getInputProps('aliases')} />
          <TextInput label="Category" {...form.getInputProps('category')} />
          <ShoppingSectionSelect
            value={form.values.shoppingSection || undefined}
            onChange={(section) => form.setFieldValue('shoppingSection', section ?? '')}
          />
          <Switch
            label={t('ingredient.usuallyAtHome')}
            {...form.getInputProps('isCommon', { type: 'checkbox' })}
          />
          <Button type="submit">Add ingredient</Button>
        </Stack>
      </form>

      {ingredients === undefined && <Text c="dimmed">Loading…</Text>}
      {ingredients?.length === 0 && <Text c="dimmed">No ingredients yet.</Text>}

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
                      Aliases: {ingredient.aliases.join(', ')}
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
                    aria-label={expanded ? 'Collapse edit section' : `Edit ${ingredient.name}`}
                    onClick={() => setExpandedId(expanded ? null : ingredient.id)}
                  >
                    {expanded ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label={`Delete ${ingredient.name}`}
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
