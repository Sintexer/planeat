import {
  ActionIcon,
  Badge,
  Button,
  Group,
  NumberInput,
  Stack,
  Text,
  Title,
  List,
  Select,
} from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useServices } from '../../app/servicesContext'
import { ScreenHeader } from '../components/ScreenHeader'
import { RecipePhotoThumb } from '../components/RecipePhotoThumb'
import {
  DISH_TYPE_LABELS,
  EFFORT_LABELS,
  MEAL_TYPE_LABELS,
  RECIPE_ROLE_LABELS,
  REUSE_POLICY_LABELS,
  type DishType,
} from '../../domain/shared/MealEnums'
import { scaleFactor } from '../../domain/shared/scaleQuantity'
import { precisionStep } from '../components/quantityStep'
import { useIngredients } from '../hooks/useIngredients'
import { usePairings } from '../hooks/usePairings'
import { useRecipe } from '../hooks/useRecipe'
import { useRecipes } from '../hooks/useRecipes'
import { useSimpleFoods } from '../hooks/useSimpleFoods'
import { useTags } from '../hooks/useTags'
import { useFormatQuantity } from '../localization/useFormatQuantity'

export function RecipeDetailScreen() {
  const { recipeId } = useParams()
  const navigate = useNavigate()
  const recipe = useRecipe(recipeId)
  const ingredients = useIngredients()
  const recipes = useRecipes()
  const simpleFoods = useSimpleFoods()
  const pairings = usePairings()
  const tags = useTags()
  const { recipeService, quantityService, pairingService } = useServices()
  const formatQty = useFormatQuantity()

  const [scaleYieldValue, setScaleYieldValue] = useState<number | ''>('')
  const [pairingPick, setPairingPick] = useState<string | null>(null)

  const ingredientNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const ingredient of ingredients ?? []) {
      map.set(ingredient.id, ingredient.name)
    }
    return map
  }, [ingredients])

  const tagsById = useMemo(() => {
    const map = new Map<string, string>()
    for (const tag of tags ?? []) map.set(tag.id, tag.name)
    return map
  }, [tags])

  const recipePairings = useMemo(() => {
    if (!recipe || !pairings) return []
    return pairings.filter(
      (p) => p.recipeId === recipe.id || (p.target.type === 'recipe' && p.target.id === recipe.id),
    )
  }, [recipe, pairings])

  const pairingOptions = useMemo(() => {
    if (!recipe || !recipes || !simpleFoods) return []
    const linked = new Set<string>()
    for (const pairing of recipePairings) {
      if (pairing.recipeId === recipe.id) {
        linked.add(`${pairing.target.type}:${pairing.target.id}`)
      } else if (pairing.target.type === 'recipe') {
        linked.add(`recipe:${pairing.recipeId}`)
      }
    }
    const options: { value: string; label: string }[] = []
    for (const other of recipes) {
      if (other.id === recipe.id) continue
      const key = `recipe:${other.id}`
      if (linked.has(key)) continue
      options.push({ value: key, label: `Recipe · ${other.name}` })
    }
    for (const food of simpleFoods) {
      const key = `simple-food:${food.id}`
      if (linked.has(key)) continue
      options.push({ value: key, label: `Simple food · ${food.name}` })
    }
    return options
  }, [recipe, recipes, simpleFoods, recipePairings])

  const pairingLabel = (pairing: (typeof recipePairings)[number]): string => {
    if (!recipe) return ''
    if (pairing.recipeId === recipe.id) {
      if (pairing.target.type === 'recipe') {
        return recipes?.find((r) => r.id === pairing.target.id)?.name ?? pairing.target.id
      }
      return simpleFoods?.find((f) => f.id === pairing.target.id)?.name ?? pairing.target.id
    }
    return recipes?.find((r) => r.id === pairing.recipeId)?.name ?? pairing.recipeId
  }

  if (recipe === undefined) {
    return <Text c="dimmed">Loading…</Text>
  }

  if (recipe === null) {
    return (
      <Stack gap="md">
        <ScreenHeader title="Recipe not found" fallbackTo="/recipes" />
        <Text c="dimmed">This recipe could not be found.</Text>
      </Stack>
    )
  }

  const targetYield =
    scaleYieldValue === '' ? recipe.yield : { value: scaleYieldValue, unit: recipe.yield.unit }
  const factor = scaleFactor(recipe.yield, targetYield) ?? 1

  const handleDelete = () => {
    modals.openConfirmModal({
      title: 'Delete recipe',
      children: (
        <Text>
          Delete “{recipe.name}”? This cannot be undone from the app (use a backup if you need it
          later).
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const result = await recipeService.deleteRecipe(recipe.id)
        if (!result.ok) {
          notifications.show({ message: 'Recipe not found', color: 'red' })
          return
        }
        notifications.show({ message: 'Recipe deleted', color: 'green' })
        navigate('/recipes')
      },
    })
  }

  return (
    <Stack gap="md">
      <ScreenHeader
        title={recipe.name}
        fallbackTo="/recipes"
        actions={
          <Group gap="xs">
            <Button component={Link} to={`/recipes/${recipe.id}/edit`} variant="light">
              Edit
            </Button>
            <Button color="red" variant="subtle" onClick={handleDelete}>
              Delete
            </Button>
          </Group>
        }
      />

      {recipe.photoUrl && <RecipePhotoThumb url={recipe.photoUrl} label={recipe.name} size={96} />}

      <Text size="sm" c="dimmed">
        Yield {formatQty(recipe.yield)} · portion {formatQty(recipe.defaultPortionPerPerson)} /
        person
      </Text>

      <Stack gap="xs">
        <Title order={4}>Organization</Title>
        <Group gap={4}>
          {recipe.roles.map((role) => (
            <Badge key={role} variant="light">
              {RECIPE_ROLE_LABELS[role]}
            </Badge>
          ))}
          {recipe.mealTypes.map((mealType) => (
            <Badge key={mealType} variant="outline">
              {MEAL_TYPE_LABELS[mealType]}
            </Badge>
          ))}
          {recipe.dishType && (
            <Badge variant="filled">
              {DISH_TYPE_LABELS[recipe.dishType as DishType] ?? recipe.dishType}
            </Badge>
          )}
          {recipe.cuisine && <Badge variant="outline">{recipe.cuisine}</Badge>}
        </Group>

        {recipe.tagIds.length > 0 && (
          <Group gap={4}>
            {recipe.tagIds.map((tagId) => {
              const name = tagsById.get(tagId)
              if (!name) return null
              return (
                <Badge key={tagId} variant="dot">
                  {name}
                </Badge>
              )
            })}
          </Group>
        )}
      </Stack>

      <Text size="sm">
        {EFFORT_LABELS[recipe.effort]} · {REUSE_POLICY_LABELS[recipe.reusePolicy]}
        {recipe.freezerFriendly ? ' · Freezer-friendly' : ''}
      </Text>

      {(recipe.activeTimeMinutes !== undefined || recipe.totalTimeMinutes !== undefined) && (
        <Text size="sm" c="dimmed">
          {recipe.activeTimeMinutes !== undefined ? `Active ${recipe.activeTimeMinutes} min` : null}
          {recipe.activeTimeMinutes !== undefined && recipe.totalTimeMinutes !== undefined
            ? ' · '
            : null}
          {recipe.totalTimeMinutes !== undefined ? `Total ${recipe.totalTimeMinutes} min` : null}
        </Text>
      )}

      <Stack gap="xs">
        <Title order={4}>Scale preview</Title>
        <Text size="sm" c="dimmed">
          Preview only — does not change the saved recipe. Unit stays {recipe.yield.unit}.
        </Text>
        <NumberInput
          label={`Scale to (${recipe.yield.unit})`}
          min={0.001}
          step={precisionStep(scaleYieldValue === '' ? recipe.yield.value : scaleYieldValue, 3)}
          decimalScale={3}
          value={scaleYieldValue === '' ? recipe.yield.value : scaleYieldValue}
          onChange={(next) => setScaleYieldValue(typeof next === 'number' ? next : '')}
        />
        {factor !== 1 && (
          <Text size="sm">
            Factor ×
            {Number.isInteger(factor)
              ? String(factor)
              : factor.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}
          </Text>
        )}
      </Stack>

      <Title order={4}>Ingredients</Title>
      {recipe.ingredientLines.length === 0 ? (
        <Text c="dimmed" size="sm">
          No ingredients listed.
        </Text>
      ) : (
        <List spacing="xs">
          {recipe.ingredientLines.map((line, index) => {
            const scaled = quantityService.scale(line.quantity, factor)
            const name = ingredientNames.get(line.ingredientId) ?? line.displayText
            return (
              <List.Item key={`${line.ingredientId}-${index}`}>
                {name}
                {scaled ? ` — ${formatQty(scaled)}` : ` — ${formatQty(null)}`}
                {line.note ? ` (${line.note})` : ''}
              </List.Item>
            )
          })}
        </List>
      )}

      <Title order={4}>Instructions</Title>
      <Text style={{ whiteSpace: 'pre-wrap' }}>
        {recipe.instructions.trim() || 'No instructions yet.'}
      </Text>

      {recipe.freezingNotes && (
        <>
          <Title order={4}>Freezing notes</Title>
          <Text style={{ whiteSpace: 'pre-wrap' }}>{recipe.freezingNotes}</Text>
        </>
      )}

      {recipe.notes && (
        <>
          <Title order={4}>Notes</Title>
          <Text style={{ whiteSpace: 'pre-wrap' }}>{recipe.notes}</Text>
        </>
      )}

      <Title order={4}>Pairs well with</Title>
      {recipePairings.length === 0 ? (
        <Text c="dimmed" size="sm">
          No pairings yet.
        </Text>
      ) : (
        <Stack gap={4}>
          {recipePairings.map((pairing) => (
            <Group key={pairing.id} justify="space-between" wrap="nowrap">
              <Text size="sm">{pairingLabel(pairing)}</Text>
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label="Remove pairing"
                onClick={() => {
                  void pairingService.remove(pairing.id).then((result) => {
                    if (!result.ok) {
                      notifications.show({ message: 'Could not remove pairing', color: 'red' })
                    }
                  })
                }}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          ))}
        </Stack>
      )}
      <Group align="flex-end" wrap="nowrap">
        <Select
          style={{ flex: 1 }}
          placeholder="Add pairing…"
          searchable
          data={pairingOptions}
          value={pairingPick}
          onChange={setPairingPick}
        />
        <Button
          disabled={!pairingPick}
          onClick={() => {
            if (!pairingPick) return
            const [type, id] = pairingPick.split(':') as ['recipe' | 'simple-food', string]
            void pairingService.add(recipe.id, { type, id }).then((result) => {
              if (!result.ok) {
                notifications.show({
                  message:
                    result.error === 'duplicate'
                      ? 'Already paired'
                      : result.error === 'self-pairing'
                        ? 'Cannot pair a recipe with itself'
                        : 'Could not add pairing',
                  color: 'red',
                })
                return
              }
              setPairingPick(null)
              notifications.show({ message: 'Pairing added', color: 'green' })
            })
          }}
        >
          Add
        </Button>
      </Group>

      {recipe.sourceUrl && (
        <Text size="sm" c="dimmed">
          Source: {recipe.sourceUrl}
        </Text>
      )}
    </Stack>
  )
}
