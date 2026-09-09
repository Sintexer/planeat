import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { AppLayout } from '../ui/layouts/AppLayout'
import { GroceryListDetailScreen } from '../ui/screens/GroceryListDetailScreen'
import { IngredientsScreen } from '../ui/screens/IngredientsScreen'
import { ListsScreen } from '../ui/screens/ListsScreen'
import { RecipeCreateScreen } from '../ui/screens/RecipeCreateScreen'
import { RecipeDetailScreen } from '../ui/screens/RecipeDetailScreen'
import { RecipeEditScreen } from '../ui/screens/RecipeEditScreen'
import { RecipesScreen } from '../ui/screens/RecipesScreen'
import { SettingsScreen } from '../ui/screens/SettingsScreen'
import { SimpleFoodsScreen } from '../ui/screens/SimpleFoodsScreen'
import { TodayScreen } from '../ui/screens/TodayScreen'
import { WeekScreen } from '../ui/screens/WeekScreen'

export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/today" replace />} />
          <Route path="today" element={<TodayScreen />} />
          <Route path="week" element={<WeekScreen />} />
          <Route path="week/:planId" element={<WeekScreen />} />
          <Route path="lists" element={<ListsScreen />} />
          <Route path="lists/:listId" element={<GroceryListDetailScreen />} />
          <Route path="recipes" element={<RecipesScreen />} />
          <Route path="recipes/new" element={<RecipeCreateScreen />} />
          <Route path="recipes/ingredients" element={<IngredientsScreen />} />
          <Route path="recipes/simple-foods" element={<SimpleFoodsScreen />} />
          <Route path="recipes/:recipeId" element={<RecipeDetailScreen />} />
          <Route path="recipes/:recipeId/edit" element={<RecipeEditScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
