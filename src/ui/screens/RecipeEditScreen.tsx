import { Text } from '@mantine/core'
import { useParams } from 'react-router'
import { RecipeEditor } from '../components/RecipeEditor'
import { useRecipe } from '../hooks/useRecipe'

export function RecipeEditScreen() {
  const { recipeId } = useParams()
  const recipe = useRecipe(recipeId)

  if (recipe === undefined) return <Text c="dimmed">Loading…</Text>
  if (recipe === null) return <Text>Recipe not found.</Text>

  return <RecipeEditor mode="edit" recipe={recipe} />
}
