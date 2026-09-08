import { Badge, Button, Group, NumberInput, Stack, Text, Title, List } from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useServices } from '../../app/servicesContext'
import {
  EFFORT_LABELS,
  MEAL_TYPE_LABELS,
  RECIPE_ROLE_LABELS,
  REUSE_POLICY_LABELS,
} from '../../domain/shared/MealEnums'
import { scaleFactor } from '../../domain/shared/scaleQuantity'
import { useIngredients } from '../hooks/useIngredients'
import { useRecipe } from '../hooks/useRecipe'

export function RecipeDetailScreen() {
  const { recipeId } = useParams()
  const navigate = useNavigate()
  const recipe = useRecipe(recipeId)
  const ingredients = useIngredients()
  const { recipeService, quantityService } = useServices()

  const [scaleYieldValue, setScaleYieldValue] = useState<number | ''>('')

  const ingredientNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const ingredient of ingredients ?? []) {
      map.set(ingredient.id, ingredient.name)
    }
    return map
  }, [ingredients])

  if (recipe === undefined) {
    return <Text c="dimmed">Loading…</Text>
  }

  if (recipe === null) {
    return (
      <Stack gap="md">
        <Text>Recipe not found.</Text>
        <Button component={Link} to="/recipes" variant="default">
          Back to recipes
        </Button>
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
      <Group justify="space-between" align="flex-start">
        <Title order={2}>{recipe.name}</Title>
        <Group gap="xs">
          <Button component={Link} to={`/recipes/${recipe.id}/edit`} variant="light">
            Edit
          </Button>
          <Button color="red" variant="subtle" onClick={handleDelete}>
            Delete
          </Button>
        </Group>
      </Group>

      <Text size="sm" c="dimmed">
        Yield {quantityService.format(recipe.yield)} · portion{' '}
        {quantityService.format(recipe.defaultPortionPerPerson)} / person
      </Text>

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
      </Group>

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
                {scaled ? ` — ${quantityService.format(scaled)}` : ' — quantity unspecified'}
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

      {recipe.sourceUrl && (
        <Text size="sm" c="dimmed">
          Source: {recipe.sourceUrl}
        </Text>
      )}

      <Button component={Link} to="/recipes" variant="default">
        Back to recipes
      </Button>
    </Stack>
  )
}
