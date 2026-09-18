import {
  Badge,
  Button,
  Group,
  MultiSelect,
  Stack,
  Switch,
  TagsInput,
  Text,
  TextInput,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useServices } from '../../app/servicesContext'
import { resolveIngredientLabel } from '../../domain/ingredients/Ingredient'
import type { MealType, RecipeRole } from '../../domain/shared/MealEnums'
import type { SimpleFood } from '../../domain/simpleFoods/SimpleFood'
import type { Tag } from '../../domain/tags/Tag'
import type { SimpleFoodService } from '../../application/simpleFoods/SimpleFoodService'
import type { TagService } from '../../application/tags/TagService'
import { QuantityFields } from '../components/QuantityFields'
import { ScreenHeader } from '../components/ScreenHeader'
import { useIngredients } from '../hooks/useIngredients'
import { useSimpleFood } from '../hooks/useSimpleFood'
import { useTags } from '../hooks/useTags'
import { tagCreateAutocompleteNames } from '../../domain/tags/Tag'
import { useFormatQuantity } from '../localization/useFormatQuantity'
import { useLocalization } from '../localization/LocalizationContext'
import { mealTypeOptions, roleOptions } from '../localization/labels'

function SimpleFoodEditableFields({
  food,
  simpleFoodService,
  tagService,
  tags,
  tagsById,
}: {
  food: SimpleFood
  simpleFoodService: SimpleFoodService
  tagService: TagService
  tags: Tag[]
  tagsById: Map<string, string>
}) {
  // Keyed by food.id from the parent, so these initial values are only read once
  // per loaded item — no effect needed to resync when the async load completes.
  const { t } = useLocalization()
  const [name, setName] = useState(food.name)
  const [portionValue, setPortionValue] = useState<number | ''>(food.defaultPortion.value)
  const [portionUnit, setPortionUnit] = useState(food.defaultPortion.unit)

  const handleNameChange = (value: string) => {
    setName(value)
    const trimmed = value.trim()
    if (!trimmed) return
    void simpleFoodService.updateSimpleFood(food.id, { name: trimmed })
  }

  const handleTagNamesChange = async (names: string[]) => {
    const ids: string[] = []
    for (const rawName of names) {
      const trimmed = rawName.trim()
      if (!trimmed) continue
      const existing = [...tagsById.entries()].find(
        ([, existingName]) => existingName.toLowerCase() === trimmed.toLowerCase(),
      )
      if (existing) {
        ids.push(existing[0])
        continue
      }
      const result = await tagService.createOrLinkByName(trimmed)
      if (result.ok) ids.push(result.tag.id)
    }
    void simpleFoodService.updateSimpleFood(food.id, { tagIds: ids })
  }

  const handlePortionValueChange = (value: number | '') => {
    setPortionValue(value)
    if (value === '' || value <= 0) return
    void simpleFoodService.updateSimpleFood(food.id, {
      defaultPortion: { value, unit: portionUnit },
    })
  }

  const handlePortionUnitChange = (unit: string) => {
    setPortionUnit(unit)
    if (portionValue === '' || portionValue <= 0) return
    void simpleFoodService.updateSimpleFood(food.id, {
      defaultPortion: { value: portionValue, unit },
    })
  }

  return (
    <>
      <TextInput
        label={t('common.name')}
        value={name}
        onChange={(event) => handleNameChange(event.currentTarget.value)}
      />

      <QuantityFields
        valueLabel={t('foods.defaultPortion')}
        value={portionValue}
        unit={portionUnit}
        min={0.001}
        onValueChange={handlePortionValueChange}
        onUnitChange={handlePortionUnitChange}
      />

      <MultiSelect
        label={t('editor.roles')}
        data={roleOptions(t)}
        value={food.roles}
        onChange={(value) =>
          void simpleFoodService.updateSimpleFood(food.id, { roles: value as RecipeRole[] })
        }
      />

      <MultiSelect
        label={t('editor.mealTypes')}
        data={mealTypeOptions(t)}
        value={food.mealTypes}
        onChange={(value) =>
          void simpleFoodService.updateSimpleFood(food.id, { mealTypes: value as MealType[] })
        }
      />

      <TagsInput
        label={t('editor.tags')}
        description={t('editor.tagsHelp')}
        data={tagCreateAutocompleteNames(tags)}
        value={food.tagIds.map((id) => tagsById.get(id)).filter((name) => name !== undefined)}
        onChange={(names) => void handleTagNamesChange(names)}
      />

      <Switch
        label={t('foods.includeSuggestions')}
        checked={food.enabledInSuggestions}
        onChange={(event) =>
          void simpleFoodService.setEnabledInSuggestions(food.id, event.currentTarget.checked)
        }
      />
    </>
  )
}

export function SimpleFoodDetailScreen() {
  const { simpleFoodId } = useParams()
  const navigate = useNavigate()
  const food = useSimpleFood(simpleFoodId)
  const ingredients = useIngredients()
  const tags = useTags()
  const { simpleFoodService, tagService } = useServices()
  const formatQty = useFormatQuantity()
  const { locale, t } = useLocalization()

  const ingredientNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const ingredient of ingredients ?? []) {
      map.set(ingredient.id, resolveIngredientLabel(ingredient, locale))
    }
    return map
  }, [ingredients, locale])

  const tagsById = useMemo(() => {
    const map = new Map<string, string>()
    for (const tag of tags ?? []) map.set(tag.id, tag.name)
    return map
  }, [tags])

  if (food === undefined) {
    return <Text c="dimmed">{t('common.loading')}</Text>
  }

  if (food === null) {
    return (
      <Stack gap="md">
        <ScreenHeader title={t('foods.notFoundTitle')} fallbackTo="/recipes" />
        <Text c="dimmed">{t('detail.foodNotFound')}</Text>
      </Stack>
    )
  }

  const handleDelete = () => {
    modals.openConfirmModal({
      title: t('foods.deleteTitle'),
      children: <Text>{t('foods.deleteBodyLong', { name: food.name })}</Text>,
      labels: { confirm: t('action.delete'), cancel: t('action.cancel') },
      confirmProps: { color: 'error' },
      onConfirm: async () => {
        const result = await simpleFoodService.deleteSimpleFood(food.id)
        if (!result.ok) {
          notifications.show({ message: t('foods.notFound'), color: 'error' })
          return
        }
        notifications.show({ message: t('foods.deleted'), color: 'success' })
        navigate('/recipes')
      },
    })
  }

  return (
    <Stack gap="md">
      <ScreenHeader
        title={food.name}
        fallbackTo="/recipes"
        actions={
          <Button color="error" variant="subtle" onClick={handleDelete}>
            {t('action.delete')}
          </Button>
        }
      />

      <Group gap={4}>
        <Badge variant="light">{t('foods.badge')}</Badge>
        <Text size="sm" c="dimmed">
          {t('foods.ingredientLine', {
            name: ingredientNames.get(food.ingredientId) ?? t('common.unknownItem'),
            quantity: formatQty(food.defaultPortion),
          })}
        </Text>
      </Group>

      <SimpleFoodEditableFields
        key={food.id}
        food={food}
        simpleFoodService={simpleFoodService}
        tagService={tagService}
        tags={tags ?? []}
        tagsById={tagsById}
      />
    </Stack>
  )
}
