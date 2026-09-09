import { Button, Checkbox, Modal, Stack, Text, TextInput, UnstyledButton } from '@mantine/core'
import { useMemo, useState } from 'react'
import type { MealType } from '../../domain/shared/MealEnums'
import { useRecipes } from '../hooks/useRecipes'
import { useSimpleFoods } from '../hooks/useSimpleFoods'

export type MealPick =
  { kind: 'recipe'; recipeId: string } | { kind: 'simple-food'; simpleFoodId: string }

interface MealItemPickerProps {
  opened: boolean
  onClose: () => void
  mealType: MealType
  onPick: (pick: MealPick) => void
}

export function MealItemPicker({ opened, onClose, mealType, onPick }: MealItemPickerProps) {
  const recipes = useRecipes()
  const simpleFoods = useSimpleFoods()
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)

  const filteredRecipes = useMemo(() => {
    if (!recipes) return []
    const q = query.trim().toLowerCase()
    return recipes.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false
      if (!showAll && !r.mealTypes.includes(mealType)) return false
      return true
    })
  }, [recipes, query, showAll, mealType])

  const filteredSimpleFoods = useMemo(() => {
    if (!simpleFoods) return []
    const q = query.trim().toLowerCase()
    return simpleFoods.filter((s) => {
      if (!s.enabledInSuggestions) return false
      if (q && !s.name.toLowerCase().includes(q)) return false
      if (!showAll && !s.mealTypes.includes(mealType)) return false
      return true
    })
  }, [simpleFoods, query, showAll, mealType])

  const handleClose = () => {
    setQuery('')
    setShowAll(false)
    onClose()
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Choose a dish" centered>
      <Stack gap="sm">
        <TextInput
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          data-autofocus
        />
        <Checkbox
          label="Show all meal types"
          checked={showAll}
          onChange={(e) => setShowAll(e.currentTarget.checked)}
        />

        <Text size="sm" fw={600}>
          Recipes
        </Text>
        {filteredRecipes.length === 0 && (
          <Text size="sm" c="dimmed">
            No matching recipes.
          </Text>
        )}
        <Stack gap={4}>
          {filteredRecipes.map((recipe) => (
            <UnstyledButton
              key={recipe.id}
              onClick={() => {
                onPick({ kind: 'recipe', recipeId: recipe.id })
                handleClose()
              }}
              p="xs"
              style={{ borderRadius: 4 }}
            >
              <Text size="sm">{recipe.name}</Text>
            </UnstyledButton>
          ))}
        </Stack>

        <Text size="sm" fw={600} mt="xs">
          Simple foods
        </Text>
        {filteredSimpleFoods.length === 0 && (
          <Text size="sm" c="dimmed">
            No matching simple foods.
          </Text>
        )}
        <Stack gap={4}>
          {filteredSimpleFoods.map((food) => (
            <UnstyledButton
              key={food.id}
              onClick={() => {
                onPick({ kind: 'simple-food', simpleFoodId: food.id })
                handleClose()
              }}
              p="xs"
              style={{ borderRadius: 4 }}
            >
              <Text size="sm">{food.name}</Text>
            </UnstyledButton>
          ))}
        </Stack>

        <Button variant="default" onClick={handleClose}>
          Cancel
        </Button>
      </Stack>
    </Modal>
  )
}
