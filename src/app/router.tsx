import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { AppLayout } from '../ui/layouts/AppLayout'
import { ListsScreen } from '../ui/screens/ListsScreen'
import { RecipesScreen } from '../ui/screens/RecipesScreen'
import { SettingsScreen } from '../ui/screens/SettingsScreen'
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
          <Route path="lists/:listId" element={<ListsScreen />} />
          <Route path="recipes" element={<RecipesScreen />} />
          <Route path="recipes/:recipeId" element={<RecipesScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
