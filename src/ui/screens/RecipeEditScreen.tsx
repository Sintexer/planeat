import { Text } from '@mantine/core'
import { useParams } from 'react-router'
import { RecipeEditor } from '../components/RecipeEditor'
import { useRecipe } from '../hooks/useRecipe'
import { useLocalization } from '../localization/LocalizationContext'

export function RecipeEditScreen() {
  const { recipeId } = useParams()
  const recipe = useRecipe(recipeId)
  const { t } = useLocalization()

  if (recipe === undefined) return <Text c="dimmed">{t('common.loading')}</Text>
  if (recipe === null) return <Text>{t('detail.recipeNotFoundShort')}</Text>

  return <RecipeEditor mode="edit" recipe={recipe} />
}
