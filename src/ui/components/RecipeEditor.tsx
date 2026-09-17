import {
  ActionIcon,
  Alert,
  Button,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  SegmentedControl,
  Stack,
  Switch,
  TagsInput,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { notifications } from '@mantine/notifications'
import { useServices } from '../../app/servicesContext'
import { resolveIngredientLabel } from '../../domain/ingredients/Ingredient'
import { REUSE_POLICIES, REUSE_POLICY_LABELS } from '../../domain/shared/MealEnums'
import type { Recipe } from '../../domain/recipes/Recipe'
import { useIngredients } from '../hooks/useIngredients'
import { useTags } from '../hooks/useTags'
import { useLocalization } from '../localization/LocalizationContext'
import { QuantityFields } from '../components/QuantityFields'
import { IngredientNameField } from '../components/IngredientNameField'
import { linkOrCreateIngredient } from '../components/IngredientCandidateModal'
import { RecipePhotoThumb } from '../components/RecipePhotoThumb'
import { ScreenHeader } from '../components/ScreenHeader'
import { importedDraftToFormValues, readAndClearImportDraft } from '../recipes/importDraft'
import {
  buildPartialWriteFromForm,
  defaultRecipeFormValues,
  emptyIngredientLine,
  formLineToIngredientLine,
  recipeToFormValues,
  type RecipeFormValues,
} from '../recipes/recipeForm'
import {
  dishTypeOptions,
  effortOptions,
  mealTypeOptions,
  roleOptions,
} from '../shared/mealEnumOptions'

const reuseOptions = REUSE_POLICIES.map((policy) => ({
  value: policy,
  label: REUSE_POLICY_LABELS[policy],
}))

interface RecipeEditorProps {
  mode: 'create' | 'edit'
  recipe?: Recipe
}

export function RecipeEditor({ mode, recipe }: RecipeEditorProps) {
  const navigate = useNavigate()
  const { recipeService, ingredientService, tagService } = useServices()
  const ingredients = useIngredients()
  const tags = useTags()
  const { locale } = useLocalization()
  const [importBootstrap] = useState(() => {
    if (mode !== 'create') return { hints: [] as string[], form: null as RecipeFormValues | null }
    const draft = readAndClearImportDraft()
    if (!draft) return { hints: [] as string[], form: null as RecipeFormValues | null }
    return { hints: draft.hints, form: importedDraftToFormValues(draft.form) }
  })
  const importHints = importBootstrap.hints

  const ingredientNamesById = useMemo(() => {
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

  const form = useForm<RecipeFormValues>({
    initialValues: importBootstrap.form ?? defaultRecipeFormValues(),
    validate: {
      name: (value) => (value.trim().length === 0 ? 'Name is required' : null),
      roles: (value) => (value.length === 0 ? 'Pick at least one role' : null),
      mealTypes: (value) => (value.length === 0 ? 'Pick at least one meal type' : null),
      yieldValue: (value) => (value === '' || value <= 0 ? 'Yield must be positive' : null),
      portionValue: (value) => (value === '' || value <= 0 ? 'Portion must be positive' : null),
      photoUrl: (value) => {
        const trimmed = value.trim()
        if (!trimmed) return null
        return /^https?:\/\//i.test(trimmed) ? null : 'Use an http or https URL'
      },
    },
  })

  const dishTypeData = useMemo(() => {
    const current = form.values.dishType
    if (!current || dishTypeOptions.some((option) => option.value === current)) {
      return dishTypeOptions
    }
    return [...dishTypeOptions, { value: current, label: current }]
  }, [form.values.dishType])

  const hydratedRecipeId = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (mode !== 'edit' || !recipe || !ingredients) return
    if (hydratedRecipeId.current === recipe.id) return
    hydratedRecipeId.current = recipe.id
    form.setValues(recipeToFormValues(recipe, ingredientNamesById))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, recipe?.id, ingredients])

  const handleTagNamesChange = async (names: string[]) => {
    const ids: string[] = []
    for (const name of names) {
      const trimmed = name.trim()
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
    form.setFieldValue('tagIds', ids)
  }

  const handleSubmit = form.onSubmit(async (values) => {
    const built = buildPartialWriteFromForm(values)
    if (!built) {
      notifications.show({ message: 'Yield and portion must be valid quantities', color: 'red' })
      return
    }

    const ingredientLines = []
    for (const line of built.lines) {
      // Most lines are already resolved eagerly while editing (IngredientNameField);
      // this is only a fallback for a line that was never confirmed via Enter/blur/select.
      let ingredientId = line.ingredientId
      if (!ingredientId) {
        const ingredient = await linkOrCreateIngredient(ingredientService, line.name, (candidate) =>
          resolveIngredientLabel(candidate, locale),
        )
        if (!ingredient) {
          notifications.show({ message: 'Could not resolve ingredient name', color: 'red' })
          return
        }
        ingredientId = ingredient.id
      }
      ingredientLines.push(formLineToIngredientLine(line, ingredientId))
    }

    const write = { ...built.base, ingredientLines }

    if (mode === 'create') {
      const result = await recipeService.createRecipe(write)
      if (!result.ok) {
        notifications.show({
          message:
            result.error === 'invalid-photo-url'
              ? 'Photo URL must start with http:// or https://'
              : `Could not save recipe (${result.error})`,
          color: 'red',
        })
        return
      }
      notifications.show({ message: 'Recipe saved', color: 'green' })
      window.setTimeout(() => {
        void navigate(`/recipes/${result.recipe.id}`, { replace: true })
      }, 0)
      return
    }

    if (!recipe) return
    const result = await recipeService.updateRecipe(recipe.id, write)
    if (!result.ok) {
      notifications.show({
        message:
          result.error === 'invalid-photo-url'
            ? 'Photo URL must start with http:// or https://'
            : `Could not save recipe (${result.error})`,
        color: 'red',
      })
      return
    }
    notifications.show({ message: 'Recipe saved', color: 'green' })
    window.setTimeout(() => {
      void navigate(`/recipes/${recipe.id}`, { replace: true })
    }, 0)
  })

  const ingredientLines = form.values.ingredientLines

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <ScreenHeader
          title={mode === 'create' ? 'New recipe' : 'Edit recipe'}
          fallbackTo={recipe ? `/recipes/${recipe.id}` : '/recipes'}
        />

        {importHints.length > 0 && (
          <Alert color="yellow" title="Imported — please confirm">
            <Stack gap={4}>
              {importHints.map((hint) => (
                <Text key={hint} size="sm">
                  {hint}
                </Text>
              ))}
            </Stack>
          </Alert>
        )}

        <TextInput label="Name" required {...form.getInputProps('name')} />

        <Group align="flex-start" wrap="nowrap" gap="md">
          <RecipePhotoThumb
            url={form.values.photoUrl.trim() || undefined}
            label={form.values.name}
            size={96}
          />
          <TextInput
            style={{ flex: 1 }}
            label="Photo URL"
            description="http(s) image link"
            {...form.getInputProps('photoUrl')}
          />
        </Group>

        <QuantityFields
          valueLabel="Yield amount"
          unitLabel="Yield unit"
          value={form.values.yieldValue}
          unit={form.values.yieldUnit}
          min={0.001}
          onValueChange={(value) => form.setFieldValue('yieldValue', value)}
          onUnitChange={(unit) => form.setFieldValue('yieldUnit', unit)}
        />

        <QuantityFields
          valueLabel="Default portion per person"
          unitLabel="Portion unit"
          value={form.values.portionValue}
          unit={form.values.portionUnit}
          min={0.001}
          onValueChange={(value) => form.setFieldValue('portionValue', value)}
          onUnitChange={(unit) => form.setFieldValue('portionUnit', unit)}
        />

        <Stack gap="sm">
          <Title order={4}>Organization</Title>
          <MultiSelect label="Roles" data={roleOptions} {...form.getInputProps('roles')} />
          <MultiSelect
            label="Meal types"
            data={mealTypeOptions}
            {...form.getInputProps('mealTypes')}
          />
          <Select
            label="Primary dish type"
            data={dishTypeData}
            clearable
            {...form.getInputProps('dishType')}
          />
          <TextInput label="Cuisine" {...form.getInputProps('cuisine')} />
          <TagsInput
            label="Tags"
            description="Pick an existing tag or type a new one"
            data={[...tagsById.values()]}
            value={form.values.tagIds
              .map((id) => tagsById.get(id))
              .filter((name) => name !== undefined)}
            onChange={(names) => void handleTagNamesChange(names)}
          />
        </Stack>

        <Select
          label="Effort"
          data={effortOptions}
          allowDeselect={false}
          {...form.getInputProps('effort')}
        />
        <Select
          label="Reuse policy"
          data={reuseOptions}
          allowDeselect={false}
          {...form.getInputProps('reusePolicy')}
        />

        <Group grow>
          <NumberInput
            label="Active time (minutes)"
            min={0}
            value={form.values.activeTimeMinutes}
            onChange={(next) =>
              form.setFieldValue('activeTimeMinutes', typeof next === 'number' ? next : '')
            }
          />
          <NumberInput
            label="Total time (minutes)"
            min={0}
            value={form.values.totalTimeMinutes}
            onChange={(next) =>
              form.setFieldValue('totalTimeMinutes', typeof next === 'number' ? next : '')
            }
          />
        </Group>

        <Switch
          label="Freezer-friendly"
          {...form.getInputProps('freezerFriendly', { type: 'checkbox' })}
        />
        {form.values.freezerFriendly && (
          <Textarea label="Freezing / reheating notes" {...form.getInputProps('freezingNotes')} />
        )}

        <TextInput label="Source URL" {...form.getInputProps('sourceUrl')} />
        <NumberInput
          label="Max preferred repeats in a plan"
          min={1}
          value={form.values.maxPreferredRepeats}
          onChange={(next) =>
            form.setFieldValue('maxPreferredRepeats', typeof next === 'number' ? next : '')
          }
        />

        <Text fw={600}>Ingredients</Text>
        <Stack gap="sm">
          {ingredientLines.map((line, index) => (
            <Stack
              key={line.key}
              gap="xs"
              p="sm"
              style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 8 }}
            >
              <Group align="flex-end" wrap="nowrap">
                <IngredientNameField
                  value={line.name}
                  ingredientId={line.ingredientId}
                  onResolved={({ name, ingredientId }) => {
                    form.setFieldValue(`ingredientLines.${index}.name`, name)
                    form.setFieldValue(`ingredientLines.${index}.ingredientId`, ingredientId)
                  }}
                  ingredients={ingredients ?? []}
                  ingredientService={ingredientService}
                  labelFor={(candidate) => resolveIngredientLabel(candidate, locale)}
                />
                <ActionIcon
                  variant="subtle"
                  color="red"
                  aria-label="Remove ingredient"
                  onClick={() =>
                    form.setFieldValue(
                      'ingredientLines',
                      ingredientLines.length === 1
                        ? [emptyIngredientLine()]
                        : ingredientLines.filter((_, i) => i !== index),
                    )
                  }
                >
                  <IconTrash size={18} />
                </ActionIcon>
              </Group>
              <SegmentedControl
                size="xs"
                data={[
                  { label: 'Amount + unit', value: 'amount' },
                  { label: 'Describe amount', value: 'text' },
                ]}
                value={line.quantityMode}
                onChange={(next) =>
                  form.setFieldValue(`ingredientLines.${index}.quantityMode`, next)
                }
              />
              {line.quantityMode === 'text' ? (
                <TextInput
                  label="Amount"
                  placeholder="e.g. to taste, a pinch"
                  value={line.quantityText}
                  onChange={(event) =>
                    form.setFieldValue(
                      `ingredientLines.${index}.quantityText`,
                      event.currentTarget.value,
                    )
                  }
                />
              ) : (
                <QuantityFields
                  value={line.quantityValue}
                  unit={line.quantityUnit}
                  onValueChange={(value) =>
                    form.setFieldValue(`ingredientLines.${index}.quantityValue`, value)
                  }
                  onUnitChange={(unit) =>
                    form.setFieldValue(`ingredientLines.${index}.quantityUnit`, unit)
                  }
                />
              )}
              <TextInput
                label="Note"
                placeholder="optional"
                value={line.note}
                onChange={(event) =>
                  form.setFieldValue(`ingredientLines.${index}.note`, event.currentTarget.value)
                }
              />
            </Stack>
          ))}
          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={() =>
              form.setFieldValue('ingredientLines', [...ingredientLines, emptyIngredientLine()])
            }
          >
            Add ingredient
          </Button>
        </Stack>

        <Textarea
          label="Instructions"
          minRows={6}
          autosize
          {...form.getInputProps('instructions')}
        />
        <Textarea label="Notes" minRows={2} {...form.getInputProps('notes')} />

        <Group>
          <Button type="submit">Save</Button>
        </Group>
      </Stack>
    </form>
  )
}
