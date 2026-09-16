import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router'
import { AppLayout } from '../ui/layouts/AppLayout'
import { GroceryListDetailScreen } from '../ui/screens/GroceryListDetailScreen'
import { IngredientsScreen } from '../ui/screens/IngredientsScreen'
import { ListsScreen } from '../ui/screens/ListsScreen'
import { PlanScreen } from '../ui/screens/PlanScreen'
import { RecipeCreateScreen } from '../ui/screens/RecipeCreateScreen'
import { RecipeDetailScreen } from '../ui/screens/RecipeDetailScreen'
import { RecipeEditScreen } from '../ui/screens/RecipeEditScreen'
import { RecipeImportScreen } from '../ui/screens/RecipeImportScreen'
import { RecipesScreen } from '../ui/screens/RecipesScreen'
import { SettingsScreen } from '../ui/screens/SettingsScreen'
import { SimpleFoodDetailScreen } from '../ui/screens/SimpleFoodDetailScreen'
import { SimpleFoodsScreen } from '../ui/screens/SimpleFoodsScreen'
import { TagsScreen } from '../ui/screens/TagsScreen'

function RedirectWeekPlanToPlan() {
  const { planId } = useParams()
  return <Navigate to={planId ? `/plan/${planId}` : '/plan'} replace />
}

export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/plan" replace />} />
          <Route path="plan" element={<PlanScreen />} />
          <Route path="plan/:planId" element={<PlanScreen />} />
          <Route path="today" element={<Navigate to="/plan" replace />} />
          <Route path="week" element={<Navigate to="/plan" replace />} />
          <Route path="week/:planId" element={<RedirectWeekPlanToPlan />} />
          <Route path="lists" element={<ListsScreen />} />
          <Route path="lists/:listId" element={<GroceryListDetailScreen />} />
          <Route path="recipes" element={<RecipesScreen />} />
          <Route path="recipes/new" element={<RecipeCreateScreen />} />
          <Route path="recipes/import" element={<RecipeImportScreen />} />
          <Route path="recipes/ingredients" element={<IngredientsScreen />} />
          <Route path="recipes/tags" element={<TagsScreen />} />
          <Route path="recipes/simple-foods" element={<SimpleFoodsScreen />} />
          <Route path="recipes/simple-foods/:simpleFoodId" element={<SimpleFoodDetailScreen />} />
          <Route path="recipes/:recipeId" element={<RecipeDetailScreen />} />
          <Route path="recipes/:recipeId/edit" element={<RecipeEditScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/plan" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
