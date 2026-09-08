import type { SimpleFood, SimpleFoodId } from '../../domain/simpleFoods/SimpleFood'
import type { IngredientId } from '../../domain/ingredients/Ingredient'
import type { MealType, RecipeRole } from '../../domain/shared/MealEnums'
import type { Quantity } from '../../domain/shared/Quantity'

export type CreateSimpleFoodInput = {
  ingredientId: IngredientId
  name: string
  defaultPortion: Quantity
  roles?: RecipeRole[]
  mealTypes?: MealType[]
  tags?: string[]
  enabledInSuggestions?: boolean
}

export type UpdateSimpleFoodInput = Partial<
  Pick<
    SimpleFood,
    | 'ingredientId'
    | 'name'
    | 'defaultPortion'
    | 'roles'
    | 'mealTypes'
    | 'tags'
    | 'enabledInSuggestions'
  >
>

export interface SimpleFoodRepository {
  create(input: CreateSimpleFoodInput): Promise<SimpleFood>
  getAll(): Promise<SimpleFood[]>
  getById(id: SimpleFoodId): Promise<SimpleFood | undefined>
  update(id: SimpleFoodId, changes: UpdateSimpleFoodInput): Promise<void>
  remove(id: SimpleFoodId): Promise<void>
}
