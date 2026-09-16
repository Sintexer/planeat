import {
  DISH_TYPE_LABELS,
  DISH_TYPES,
  EFFORT_LABELS,
  EFFORT_LEVELS,
  MEAL_TYPE_LABELS,
  MEAL_TYPES,
  RECIPE_ROLE_LABELS,
  RECIPE_ROLES,
} from '../../domain/shared/MealEnums'

export const roleOptions = RECIPE_ROLES.map((role) => ({
  value: role,
  label: RECIPE_ROLE_LABELS[role],
}))

export const mealTypeOptions = MEAL_TYPES.map((mealType) => ({
  value: mealType,
  label: MEAL_TYPE_LABELS[mealType],
}))

export const effortOptions = EFFORT_LEVELS.map((effort) => ({
  value: effort,
  label: EFFORT_LABELS[effort],
}))

export const dishTypeOptions = DISH_TYPES.map((dishType) => ({
  value: dishType,
  label: DISH_TYPE_LABELS[dishType],
}))
