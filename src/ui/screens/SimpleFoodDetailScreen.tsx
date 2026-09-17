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
import type { SimpleFoodService } from '../../application/simpleFoods/SimpleFoodService'
import type { TagService } from '../../application/tags/TagService'
import { QuantityFields } from '../components/QuantityFields'
import { ScreenHeader } from '../components/ScreenHeader'
import { useIngredients } from '../hooks/useIngredients'
import { useSimpleFood } from '../hooks/useSimpleFood'
import { useTags } from '../hooks/useTags'
import { useFormatQuantity } from '../localization/useFormatQuantity'
import { useLocalization } from '../localization/LocalizationContext'
import { mealTypeOptions, roleOptions } from '../shared/mealEnumOptions'

function SimpleFoodEditableFields({
  food,
  simpleFoodService,
  tagService,
  tagsById,
}: {
  food: SimpleFood
  simpleFoodService: SimpleFoodService
  tagService: TagService
  tagsById: Map<string, string>
}) {
  // Keyed by food.id from the parent, so these initial values are only read once
  // per loaded item — no effect needed to resync when the async load completes.
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
        label="Name"
        value={name}
        onChange={(event) => handleNameChange(event.currentTarget.value)}
      />

      <QuantityFields
        valueLabel="Default portion"
        value={portionValue}
        unit={portionUnit}
        min={0.001}
        onValueChange={handlePortionValueChange}
        onUnitChange={handlePortionUnitChange}
      />

      <MultiSelect
        label="Roles"
        data={roleOptions}
        value={food.roles}
        onChange={(value) =>
          void simpleFoodService.updateSimpleFood(food.id, { roles: value as RecipeRole[] })
        }
      />

      <MultiSelect
        label="Meal types"
        data={mealTypeOptions}
        value={food.mealTypes}
        onChange={(value) =>
          void simpleFoodService.updateSimpleFood(food.id, { mealTypes: value as MealType[] })
        }
      />

      <TagsInput
        label="Tags"
        description="Pick an existing tag or type a new one"
        data={[...tagsById.values()]}
        value={food.tagIds.map((id) => tagsById.get(id)).filter((name) => name !== undefined)}
        onChange={(names) => void handleTagNamesChange(names)}
      />

      <Switch
        label="Include in meal suggestions"
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
  const { locale } = useLocalization()

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
    return <Text c="dimmed">Loading…</Text>
  }

  if (food === null) {
    return (
      <Stack gap="md">
        <ScreenHeader title="Simple food not found" fallbackTo="/recipes" />
        <Text c="dimmed">This simple food could not be found.</Text>
      </Stack>
    )
  }

  const handleDelete = () => {
    modals.openConfirmModal({
      title: 'Delete simple food',
      children: (
        <Text>
          Delete “{food.name}” as a standalone suggestion? The underlying ingredient stays in the
          catalog.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const result = await simpleFoodService.deleteSimpleFood(food.id)
        if (!result.ok) {
          notifications.show({ message: 'Simple food not found', color: 'red' })
          return
        }
        notifications.show({ message: 'Simple food deleted', color: 'green' })
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
          <Button color="red" variant="subtle" onClick={handleDelete}>
            Delete
          </Button>
        }
      />

      <Group gap={4}>
        <Badge variant="light">Simple food</Badge>
        <Text size="sm" c="dimmed">
          Ingredient: {ingredientNames.get(food.ingredientId) ?? 'Unknown'} · Default{' '}
          {formatQty(food.defaultPortion)}
        </Text>
      </Group>

      <SimpleFoodEditableFields
        key={food.id}
        food={food}
        simpleFoodService={simpleFoodService}
        tagService={tagService}
        tagsById={tagsById}
      />
    </Stack>
  )
}
