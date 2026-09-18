import { defaultDishCatalogFilters, type DishCatalogFilters } from '../catalog/catalogModel'

/**
 * Survives RecipesScreen unmount/remount (e.g. opening a recipe and navigating back),
 * which a component-local useState cannot do.
 */
export const recipesBrowseState: {
  filters: DishCatalogFilters
  scrollY: number
  loadedViewId: string | null
} = {
  filters: defaultDishCatalogFilters('all'),
  scrollY: 0,
  loadedViewId: null,
}
