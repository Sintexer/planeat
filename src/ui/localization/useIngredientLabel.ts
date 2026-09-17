import { resolveIngredientLabel, type Ingredient } from '../../domain/ingredients/Ingredient'
import { useLocalization } from './LocalizationContext'

/** Returns a function that resolves an ingredient's display label for the active locale. */
export function useIngredientLabel() {
  const { locale } = useLocalization()
  return (ingredient: Ingredient) => resolveIngredientLabel(ingredient, locale)
}
